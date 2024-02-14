/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief
 *
 */

#include <zephyr/types.h>
#include <zephyr/logging/log.h>
#include <zephyr/kernel.h>

#include "webusb.h"
#include "broadcast_assistant.h"
#include "command.h"

LOG_MODULE_REGISTER(command, LOG_LEVEL_DBG);


#define HEARTBEAT_ON 1


static void heartbeat_timeout_handler(struct k_timer *dummy_p);
K_TIMER_DEFINE(heartbeat_timer, heartbeat_timeout_handler, NULL);


static void heartbeat_timeout_handler(struct k_timer *timer)
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

void send_response(enum message_sub_type type, uint8_t seq_no)
{
	/* For now, just send ACK
	 * TODO: Send Error back if it failed
	 */
	int ret;
	// Assemble Dummy response and send (payload size = 0)
	uint8_t buf[] = {
		MESSAGE_TYPE_RES,
		type,
		seq_no,
		0,0
	};
	ret = webusb_transmit((uint8_t*)&buf, sizeof(buf));
	if (ret != 0) {
		LOG_ERR("FAILED TO SEND response (err=%d)", ret);
	}
}

void send_error_response(void) {
	// Assemble OK response and send
	uint8_t payload[] = { 'E', 'R', 'R'};
	if (webusb_transmit((uint8_t*)&payload, sizeof(payload)) != 0) {
		LOG_ERR("FAILED TO SEND ");
	}
}

void command_handler(struct command_message *command_ptr, uint16_t command_length)
{
	// MISSING PARSING OF COMMANDS AND DEFINITIONS OF THOSE !!!!
	//uint8_t msg_type = command_ptr->type;
	uint8_t msg_sub_type = command_ptr->sub_type;
	uint8_t msg_seq_no = command_ptr->seq_no;

	switch (msg_sub_type) {
		case MESSAGE_SUBTYPE_HEARTBEAT:
			if (HEARTBEAT_ON) {
				// Start generating heartbeats every second
				k_timer_start(&heartbeat_timer, K_SECONDS(1), K_SECONDS(1));
			} else {
				// Stop heartbeat timer if running
				k_timer_stop(&heartbeat_timer);
			}
			send_ok_response();
			break;

		case MESSAGE_SUBTYPE_DUMMY:
			LOG_DBG("DUMMY CMD received... send response...");
			send_dummy_response(msg_seq_no);
			break;

		case MESSAGE_SUBTYPE_START_SINK_SCAN:
			LOG_DBG("MESSAGE_SUBTYPE_START_SINK_SCAN");
			scan_for_broadcast_sink(msg_seq_no);
			break;

		case MESSAGE_SUBTYPE_START_SOURCE_SCAN:
			LOG_DBG("MESSAGE_SUBTYPE_START_SOURCE_SCAN");
			scan_for_broadcast_source(msg_seq_no);
			break;

		case MESSAGE_SUBTYPE_STOP_SCAN:
			LOG_DBG("MESSAGE_SUBTYPE_STOP_SCAN");
			stop_scanning(msg_seq_no);
			break;

		default:
			// Unrecognized command
			send_error_response();
			break;
	}
}


void command_init(void) {
	k_timer_init(&heartbeat_timer, heartbeat_timeout_handler, NULL);
}

