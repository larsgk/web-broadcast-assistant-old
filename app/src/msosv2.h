/*
 * SPDX-License-Identifier: Apache-2.0
 */

#include <zephyr/sys/byteorder.h>
#include <zephyr/usb/usb_device.h>
#include <zephyr/usb/bos.h>
#include <zephyr/usb/msos_desc.h>

#include "webusb.h"


USB_DEVICE_BOS_DESC_DEFINE_CAP struct __packed usb_bos_webusb_desc {
	struct usb_bos_platform_descriptor platform;
	struct usb_bos_capability_webusb cap;
} bos_cap_webusb;

USB_DEVICE_BOS_DESC_DEFINE_CAP struct __packed usb_bos_msosv2_desc {
	struct usb_bos_platform_descriptor platform;
	struct usb_bos_capability_msos cap;
} bos_cap_msosv2;

USB_DEVICE_BOS_DESC_DEFINE_CAP struct usb_bos_capability_lpm bos_cap_lpm;

int msosv2_custom_handle_req(struct usb_setup_packet *pSetup, int32_t *len, uint8_t **data);

int msosv2_vendor_handle_req(struct usb_setup_packet *pSetup, int32_t *len, uint8_t **data);

