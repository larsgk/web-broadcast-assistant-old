/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief Sample app for a WebUSB Broadcast Assistant
 */

#include <zephyr/types.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/usb/usb_device.h>
#include <zephyr/usb/bos.h>
#include <zephyr/usb/msos_desc.h>

#include "webusb.h"
#include "msosv2.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_DBG);

enum MessageType {
	MESSAGE_TYPE_CMD = 1,
	MESSAGE_TYPE_RES,
	MESSAGE_TYPE_EVT,
};

enum MessageSubType {
	/* CMD/RES (bit7 = 0) */
	MESSAGE_SUBTYPE_START_SINK_SCAN		= 0x01,
	MESSAGE_SUBTYPE_START_SOURCE_SCAN	= 0x02,

	MESSAGE_SUBTYPE_DUMMY			= 0x7F,

	/* EVT (bit7 = 1) */
	MESSAGE_SUBTYPE_SINK_FOUND		= 0x81,
	MESSAGE_SUBTYPE_SOURCE_FOUND		= 0x82,

	MESSAGE_SUBTYPE_HEARTBEAT		= 0xFF,
};


static void heartbeat_timeout_handler(struct k_timer *dummy_p);
K_TIMER_DEFINE(heartbeat_timer, heartbeat_timeout_handler, NULL);


void heartbeat_timeout_handler(struct k_timer *timer)
{
	// Assemble heartbeat event and send
	uint8_t payload[] = { 'H', 'E', 'A', 'R', 'T'};

	if (webusb_transmit((uint8_t*)&payload, sizeof(payload)) != 0) {
		LOG_ERR("FAILED TO SEND ");
	}
}

void send_ok_response(void) {
	// Assemble OK response and send
	uint8_t payload[] = { 'O', 'K'};
	if (webusb_transmit((uint8_t*)&payload, sizeof(payload)) != 0) {
		LOG_ERR("FAILED TO SEND ");
	}
}

void send_dummy_response(uint8_t seq_no) {
	int ret;
	// Assemble Dummy response and send (payload size = 0)
	uint8_t buf[] = {
		MESSAGE_TYPE_RES,
		MESSAGE_SUBTYPE_DUMMY,
		seq_no,
		0,0
	};
	ret = webusb_transmit((uint8_t*)&buf, sizeof(buf));
	if (ret != 0) {
		LOG_ERR("FAILED TO SEND Dummy response (err=%d)", ret);
	}
}

void send_error_response(void) {
	// Assemble OK response and send
	uint8_t payload[] = { 'E', 'R', 'R'};
	if (webusb_transmit((uint8_t*)&payload, sizeof(payload)) != 0) {
		LOG_ERR("FAILED TO SEND ");
	}
}

void command_handler(uint8_t *command_ptr, uint16_t command_length)
{
	// MISSING PARSING OF COMMANDS AND DEFINITIONS OF THOSE !!!!
	uint8_t msg_type = command_ptr[0];
	uint8_t msg_sub_type = command_ptr[1];
	uint8_t msg_seq_no = command_ptr[2];
	#define HEARTBEAT 1
	#define ON 1

	#define DUMMY 0x7F

	switch (msg_sub_type) {
		case HEARTBEAT:
			if (ON) {
				// Start generating heartbeats every second
				k_timer_start(&heartbeat_timer, K_SECONDS(1), K_SECONDS(1));
			} else {
				// Stop heartbeat timer if running
				k_timer_stop(&heartbeat_timer);
			}
			send_ok_response();
			break;

		case DUMMY:
			LOG_DBG("DUMMY CMD received... send response...");
			send_dummy_response(msg_seq_no);
			break;

		default:
			// Unrecognized command
			send_error_response();
			break;
	}
}


int main(void)
{
	int ret;

	LOG_DBG("");

	/* Initialize WebUSB component */
	msosv2_init();
	webusb_init();

	/* Set the command handler */
	webusb_register_command_handler(&command_handler);

	/* Initialize timers */
	k_timer_init(&heartbeat_timer, heartbeat_timeout_handler, NULL);

	ret = usb_enable(NULL);
	if (ret != 0) {
		LOG_ERR("Failed to enable USB");
		return 0;
	}
	return 0;
}
