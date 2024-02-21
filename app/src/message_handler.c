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

LOG_MODULE_REGISTER(message_handler, LOG_LEVEL_DBG);

#define HEARTBEAT_ON 1

static K_SEM_DEFINE(webusb_msg_sem, 1, 1);

static void heartbeat_timeout_handler(struct k_timer *dummy_p);
K_TIMER_DEFINE(heartbeat_timer, heartbeat_timeout_handler, NULL);

static void send_simple_message(enum message_type mtype, enum message_sub_type stype, uint8_t seq_no, int32_t rc);

static struct webusb_message webusb_msg;


static void heartbeat_timeout_handler(struct k_timer *timer)
{
	// Assemble heartbeat event and send
	uint8_t payload[] = { 'H', 'E', 'A', 'R', 'T'};

	if (webusb_transmit((uint8_t*)&payload, sizeof(payload)) != 0) {
		LOG_ERR("FAILED TO SEND ");
	}
}

static void send_simple_message(enum message_type mtype, enum message_sub_type stype, uint8_t seq_no, int32_t rc)
{
	int ret;

	LOG_INF("send simple message(%d, %d, %u, %d)", mtype, stype, seq_no, rc);

	k_sem_take(&webusb_msg_sem, K_FOREVER);
	memset(&webusb_msg, 0, sizeof(struct webusb_message));

	webusb_msg.type = mtype;
	webusb_msg.sub_type = stype;
	webusb_msg.seq_no = seq_no;
	webusb_msg.length = 0;

	/* Add error code */
	webusb_msg.payload[webusb_msg.length++] = 5;
	webusb_msg.payload[webusb_msg.length++] = BT_DATA_ERROR_CODE;
	sys_put_le32(rc, &webusb_msg.payload[webusb_msg.length]);
	webusb_msg.length += 4;

	ret = webusb_transmit((uint8_t *)&webusb_msg,
			      webusb_msg.length + offsetof(struct webusb_message, payload));
	if (ret != 0) {
		LOG_ERR("Failed to send message (err=%d)", ret);
	}

	k_sem_give(&webusb_msg_sem);

}

void send_response(enum message_sub_type stype, uint8_t seq_no, int32_t rc)
{
	send_simple_message(MESSAGE_TYPE_RES, stype, seq_no, rc);
}

void send_event(enum message_sub_type stype, int32_t rc)
{
	send_simple_message(MESSAGE_TYPE_EVT, stype, 0, rc);
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
		msg_rc = stop_scanning();
		send_response(MESSAGE_SUBTYPE_STOP_SCAN, msg_seq_no, msg_rc);
		break;

	case MESSAGE_SUBTYPE_CONNECT_SINK:
		LOG_DBG("MESSAGE_SUBTYPE_CONNECT_SINK (len %u)", msg_length);
		msg_rc = connect_to_sink(msg_seq_no, msg_length, &msg_ptr->payload[0]);
		send_response(MESSAGE_SUBTYPE_CONNECT_SINK, msg_seq_no, msg_rc);
		break;

	case MESSAGE_SUBTYPE_DISCONNECT_SINK:
		LOG_DBG("MESSAGE_SUBTYPE_DISCONNECT_SINK (len %u)", msg_length);
		msg_rc = disconnect_from_sink(msg_seq_no, msg_length, &msg_ptr->payload[0]);
		send_response(MESSAGE_SUBTYPE_DISCONNECT_SINK, msg_seq_no, msg_rc);
		break;

	case MESSAGE_SUBTYPE_ADD_SOURCE:
		LOG_DBG("MESSAGE_SUBTYPE_ADD_SOURCE (len %u)", msg_length);
		msg_rc = add_source(msg_seq_no, msg_length, &msg_ptr->payload[0]);
		send_response(MESSAGE_SUBTYPE_ADD_SOURCE, msg_seq_no, msg_rc);

	case MESSAGE_SUBTYPE_RESET:
		LOG_DBG("MESSAGE_SUBTYPE_RESET (len %u)", msg_length);
		msg_rc = stop_scanning();
		send_response(MESSAGE_SUBTYPE_STOP_SCAN, msg_seq_no, msg_rc);
		msg_rc = disconnect_unpair_all();
		send_response(MESSAGE_SUBTYPE_RESET, msg_seq_no, msg_rc);
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

