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
#include <zephyr/sys/byteorder.h>

#include "webusb.h"
#include "broadcast_assistant.h"
#include "message_handler.h"

LOG_MODULE_REGISTER(command, LOG_LEVEL_DBG);


#define HEARTBEAT_ON 1

static void heartbeat_timeout_handler(struct k_timer *dummy_p);
K_TIMER_DEFINE(heartbeat_timer, heartbeat_timeout_handler, NULL);

static void send_response(enum message_sub_type type, uint8_t seq_no, int32_t rc);

static struct webusb_message webusb_rsp;


static void heartbeat_timeout_handler(struct k_timer *timer)
{
	// Assemble heartbeat event and send
	uint8_t payload[] = { 'H', 'E', 'A', 'R', 'T'};

	if (webusb_transmit((uint8_t*)&payload, sizeof(payload)) != 0) {
		LOG_ERR("FAILED TO SEND ");
	}
}

static void send_response(enum message_sub_type type, uint8_t seq_no, int32_t rc)
{
	int ret;

	LOG_INF("send_response(%d, %u, %d)", type, seq_no, rc);

	webusb_rsp.type = MESSAGE_TYPE_RES;
	webusb_rsp.sub_type = type;
	webusb_rsp.seq_no = seq_no;
	webusb_rsp.length = 0;

	/* Add error code */
	webusb_rsp.payload[webusb_rsp.length++] = 5;
	webusb_rsp.payload[webusb_rsp.length++] = BT_DATA_ERROR_CODE;
	sys_put_le32(rc, &webusb_rsp.payload[webusb_rsp.length]);
	webusb_rsp.length += 4;

	ret = webusb_transmit((uint8_t *)&webusb_rsp,
			      webusb_rsp.length + offsetof(struct webusb_message, payload));
	if (ret != 0) {
		LOG_ERR("Failed to send response (err=%d)", ret);
	}
}

void message_handler(struct webusb_message *msg_ptr, uint16_t msg_length)
{
	//uint8_t msg_type = msg_ptr->type;
	uint8_t msg_sub_type = msg_ptr->sub_type;
	uint8_t msg_seq_no = msg_ptr->seq_no;
	int32_t msg_rc = 0;

	switch (msg_sub_type) {
	case MESSAGE_SUBTYPE_HEARTBEAT:
		if (HEARTBEAT_ON) {
			// Start generating heartbeats every second
			k_timer_start(&heartbeat_timer, K_SECONDS(1), K_SECONDS(1));
		} else {
			// Stop heartbeat timer if running
			k_timer_stop(&heartbeat_timer);
		}
		send_response(msg_sub_type, msg_seq_no, 0);
		break;

	case MESSAGE_SUBTYPE_DUMMY:
		LOG_DBG("MESSAGE_SUBTYPE_DUMMY");
		send_response(msg_sub_type, msg_seq_no, 0);
		break;

	case MESSAGE_SUBTYPE_START_SINK_SCAN:
		LOG_DBG("MESSAGE_SUBTYPE_START_SINK_SCAN");
		msg_rc = scan_for_broadcast_sink(msg_seq_no);
		send_response(MESSAGE_SUBTYPE_START_SINK_SCAN, msg_seq_no, msg_rc);
		break;

	case MESSAGE_SUBTYPE_START_SOURCE_SCAN:
		LOG_DBG("MESSAGE_SUBTYPE_START_SOURCE_SCAN");
		msg_rc = scan_for_broadcast_source(msg_seq_no);
		send_response(MESSAGE_SUBTYPE_START_SOURCE_SCAN, msg_seq_no, msg_rc);
		break;

	case MESSAGE_SUBTYPE_STOP_SCAN:
		LOG_DBG("MESSAGE_SUBTYPE_STOP_SCAN");
		msg_rc = stop_scanning(msg_seq_no);
		send_response(MESSAGE_SUBTYPE_STOP_SCAN, msg_seq_no, msg_rc);
		break;

	case MESSAGE_SUBTYPE_CONNECT_SINK:
		LOG_DBG("MESSAGE_SUBTYPE_CONNECT_SINK (len %u)", msg_length);
		msg_rc = connect_to_sink(msg_seq_no, msg_length, &msg_ptr->payload[0]);
		send_response(MESSAGE_SUBTYPE_CONNECT_SINK, msg_seq_no, msg_rc);
		break;

	default:
		// Unrecognized message
		send_response(msg_sub_type, msg_seq_no, -1);
		break;
	}
}

void message_handler_init(void)
{
	k_timer_init(&heartbeat_timer, heartbeat_timeout_handler, NULL);
}

