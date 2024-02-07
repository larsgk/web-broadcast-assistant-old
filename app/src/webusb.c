/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief WebUSB enabled custom class driver
 *
 * This is a modified version of CDC ACM class driver
 * to support the WebUSB.
 */

#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(webusb, LOG_LEVEL_ERR);


#include <zephyr/kernel.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/sys/ring_buffer.h>
#include <zephyr/usb/usb_device.h>
#include <usb_descriptor.h>

#include "webusb.h"
#include "cobs.h"
#include "msosv2.h"

/* Max packet size for Bulk endpoints */
#if defined(CONFIG_USB_DC_HAS_HS_SUPPORT)
#define WEBUSB_BULK_EP_MPS		512
#else
#define WEBUSB_BULK_EP_MPS		COBS_ENCODE_DST_BUF_LEN_MAX(CONFIG_WEBUSB_APPLICATION_TX_MAX_PAYLOAD_SIZE)
#endif

/* Number of interfaces */
#define WEBUSB_NUM_ITF			0x01
/* Number of Endpoints in the custom interface */
#define WEBUSB_NUM_EP			0x02

#define WEBUSB_IN_EP_IDX		0
#define WEBUSB_OUT_EP_IDX		1

#define WEBUSB_WORKQUEUE_STACK_SIZE 2048
#define WEBUSB_WORKQUEUE_PRIORITY K_PRIO_PREEMPT(1)

void (*webusb_cmd_handler)(uint8_t *command_ptr, uint16_t command_length);

uint8_t rx_buf[WEBUSB_BULK_EP_MPS];

#define INITIALIZER_IF(num_ep, iface_class)				\
	{								\
		.bLength = sizeof(struct usb_if_descriptor),		\
		.bDescriptorType = USB_DESC_INTERFACE,			\
		.bInterfaceNumber = 0,					\
		.bAlternateSetting = 0,					\
		.bNumEndpoints = num_ep,				\
		.bInterfaceClass = iface_class,				\
		.bInterfaceSubClass = 0,				\
		.bInterfaceProtocol = 0,				\
		.iInterface = 0,					\
	}

#define INITIALIZER_IF_EP(addr, attr, mps, interval)			\
	{								\
		.bLength = sizeof(struct usb_ep_descriptor),		\
		.bDescriptorType = USB_DESC_ENDPOINT,			\
		.bEndpointAddress = addr,				\
		.bmAttributes = attr,					\
		.wMaxPacketSize = sys_cpu_to_le16(mps),			\
		.bInterval = interval,					\
	}

USBD_CLASS_DESCR_DEFINE(primary, 0) struct {
	struct usb_if_descriptor if0;
	struct usb_ep_descriptor if0_in_ep;
	struct usb_ep_descriptor if0_out_ep;
} __packed webusb_desc = {
	.if0 = INITIALIZER_IF(WEBUSB_NUM_EP, USB_BCC_VENDOR),
	.if0_in_ep = INITIALIZER_IF_EP(AUTO_EP_IN, USB_DC_EP_BULK,
				       WEBUSB_BULK_EP_MPS, 0),
	.if0_out_ep = INITIALIZER_IF_EP(AUTO_EP_OUT, USB_DC_EP_BULK,
					WEBUSB_BULK_EP_MPS, 0),
};

/* Describe EndPoints configuration */
static struct usb_ep_cfg_data webusb_ep_data[] = {
	{
		.ep_cb = usb_transfer_ep_callback,
		.ep_addr = AUTO_EP_IN
	},
	{
		.ep_cb	= usb_transfer_ep_callback,
		.ep_addr = AUTO_EP_OUT
	}
};


typedef struct {
	uint16_t size;
	uint8_t data[CONFIG_WEBUSB_APPLICATION_TX_MAX_PAYLOAD_SIZE];
} webusb_tx_msg_t;

struct k_work_q webusb_workqueue;
K_THREAD_STACK_DEFINE(webusb_workqueue_stack, WEBUSB_WORKQUEUE_STACK_SIZE);

static void webusb_rx_work_handler(struct k_work *work_p);
K_WORK_DEFINE(webusb_rx_work, webusb_rx_work_handler);
static void webusb_tx_work_handler(struct k_work *work_p);
K_WORK_DEFINE(webusb_tx_work, webusb_tx_work_handler);
K_MSGQ_DEFINE(webusb_tx_msg_queue, sizeof(webusb_tx_msg_t), CONFIG_WEBUSB_TX_MSG_QUEUE_SIZE, 4);

uint8_t cobs_decoded_stream[WEBUSB_BULK_EP_MPS];
uint16_t cobs_decoded_length;
uint8_t cobs_encoded_stream[WEBUSB_BULK_EP_MPS];

void webusb_init(void)
{
	usb_bos_register_cap((void *)&bos_cap_webusb);
	usb_bos_register_cap((void *)&bos_cap_msosv2);
	usb_bos_register_cap((void *)&bos_cap_lpm);

	k_work_init(&webusb_rx_work, webusb_rx_work_handler);
	k_work_init(&webusb_tx_work, webusb_tx_work_handler);

	k_work_queue_start(&webusb_workqueue,
	                   webusb_workqueue_stack,
	                   K_THREAD_STACK_SIZEOF(webusb_workqueue_stack),
	                   WEBUSB_WORKQUEUE_PRIORITY,
	                   NULL);
	k_thread_name_set(&webusb_workqueue.thread, "webusbworker");
}

int webusb_transmit(uint8_t *data, uint16_t size)
{
	webusb_tx_msg_t tx_msg;
	int ret;

	if (size > CONFIG_WEBUSB_APPLICATION_TX_MAX_PAYLOAD_SIZE) {
		return -EINVAL;
	}

	memcpy(tx_msg.data, data, size);
	tx_msg.size = size;

	ret = k_msgq_put(&webusb_tx_msg_queue, &tx_msg, K_NO_WAIT);
	if (ret < 0) {
		return ret;
	}
	ret = k_work_submit_to_queue(&webusb_workqueue, &webusb_tx_work);
	return ret;
}

static void webusb_rx_work_handler(struct k_work *work_p)
{
	ARG_UNUSED(work_p);

	if (webusb_cmd_handler) {
		webusb_cmd_handler((uint8_t*)&cobs_decoded_stream, cobs_decoded_length);
	}
}

static void webusb_tx_work_handler(struct k_work *work_p)
{
	ARG_UNUSED(work_p);

	webusb_tx_msg_t tx_msg;

	while (k_msgq_get(&webusb_tx_msg_queue, &tx_msg, K_NO_WAIT) == 0) {

		cobs_encode_result result;

		// Leave room for a terminating zero byte.
		result = cobs_encode(&cobs_encoded_stream, sizeof(cobs_encoded_stream)-1, &tx_msg.data, tx_msg.size);
		if (result.status != COBS_ENCODE_OK) {
			LOG_ERR("COBS Encoding failed: %d", result.status);
		}
		cobs_encoded_stream[result.out_len++] = '\0';

		// We will never send more than WEBUSB_BULK_EP_MPS so we should
		// be able to do it as a sync transfer and not handle callbacks.
		usb_transfer_sync(webusb_ep_data[WEBUSB_IN_EP_IDX].ep_addr, cobs_encoded_stream,
		                  result.out_len, USB_TRANS_WRITE);
	}
}

/**
 * @brief Custom handler for standard requests in order to
 *        catch the request and return the WebUSB Platform
 *        Capability Descriptor.
 *
 * @param pSetup    Information about the request to execute.
 * @param len       Size of the buffer.
 * @param data      Buffer containing the request result.
 *
 * @return  0 on success, negative errno code on fail.
 */
int webusb_custom_handle_req(struct usb_setup_packet *pSetup,
			     int32_t *len, uint8_t **data)
{
	/* Call the handler */
	return msosv2_custom_handle_req(pSetup, len, data);
}

/**
 * @brief Handler called for WebUSB vendor specific commands.
 *
 * @param pSetup    Information about the request to execute.
 * @param len       Size of the buffer.
 * @param data      Buffer containing the request result.
 *
 * @return  0 on success, negative errno code on fail.
 */
int webusb_vendor_handle_req(struct usb_setup_packet *pSetup,
			     int32_t *len, uint8_t **data)
{
	/* Call the handler */
	return msosv2_vendor_handle_req(pSetup, len, data);
}

/**
 * @brief Register Command Handler callback
 *
 * This function registers a Command Handler for handling the
 * device requests.
 *
 * @param [in] handlers Pointer to WebUSB command handler structure
 */
void webusb_register_command_handler(void (*webusb_cmd_handler)(uint8_t *command_ptr, uint16_t command_length))
{
	webusb_cmd_handler = webusb_cmd_handler;
}

static void webusb_read_cb(uint8_t ep, int size, void *priv)
{
	struct usb_cfg_data *cfg = priv;
	cobs_decode_result result;

	LOG_DBG("cfg %p ep %x size %u", cfg, ep, size);

	if ((size <= 0) || (!rx_buf[size-1])) {
		// Skip empty or non null terminated packages
		goto done;
	}

	result = cobs_decode(&cobs_decoded_stream, sizeof(cobs_decoded_stream), rx_buf, strlen(rx_buf));
	if (result.status == COBS_DECODE_OK) {
		cobs_decoded_length = result.out_len;
		k_work_submit_to_queue(&webusb_workqueue, &webusb_rx_work);
	} else {
		LOG_ERR("Could not decode received COBS encoded data! - err: %d", result.status);
	}

done:
	usb_transfer(ep, rx_buf, sizeof(rx_buf), USB_TRANS_READ, webusb_read_cb, cfg);
}

/**
 * @brief Callback used to know the USB connection status
 *
 * @param status USB device status code.
 */
static void webusb_dev_status_cb(struct usb_cfg_data *cfg,
				 enum usb_dc_status_code status,
				 const uint8_t *param)
{
	ARG_UNUSED(param);
	ARG_UNUSED(cfg);

	/* Check the USB status and do needed action if required */
	switch (status) {
	case USB_DC_ERROR:
		LOG_DBG("USB device error");
		break;
	case USB_DC_RESET:
		LOG_DBG("USB device reset detected");
		break;
	case USB_DC_CONNECTED:
		LOG_DBG("USB device connected");
		break;
	case USB_DC_CONFIGURED:
		LOG_DBG("USB device configured");
		webusb_read_cb(cfg->endpoint[WEBUSB_OUT_EP_IDX].ep_addr,
			       0, cfg);
		break;
	case USB_DC_DISCONNECTED:
		LOG_DBG("USB device disconnected");
		break;
	case USB_DC_SUSPEND:
		LOG_DBG("USB device suspended");
		break;
	case USB_DC_RESUME:
		LOG_DBG("USB device resumed");
		break;
	case USB_DC_UNKNOWN:
	default:
		LOG_DBG("USB unknown state");
		break;
	}
}

USBD_DEFINE_CFG_DATA(webusb_config) = {
	.usb_device_description = NULL,
	.interface_descriptor = &webusb_desc.if0,
	.cb_usb_status = webusb_dev_status_cb,
	.interface = {
		.class_handler = NULL,
		.custom_handler = webusb_custom_handle_req,
		.vendor_handler = webusb_vendor_handle_req,
	},
	.num_endpoints = ARRAY_SIZE(webusb_ep_data),
	.endpoint = webusb_ep_data
};