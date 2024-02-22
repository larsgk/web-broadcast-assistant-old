/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief
 *
 */

#ifndef __COMMAND_H__
#define __COMMAND_H__

#include <zephyr/types.h>

enum message_type {
	MESSAGE_TYPE_CMD = 1,
	MESSAGE_TYPE_RES,
	MESSAGE_TYPE_EVT,
};

enum message_sub_type {
	/* CMD/RES (bit7 = 0) */
	MESSAGE_SUBTYPE_START_SINK_SCAN   = 0x01,
	MESSAGE_SUBTYPE_START_SOURCE_SCAN = 0x02,
	MESSAGE_SUBTYPE_START_SCAN_ALL    = 0x03,
	MESSAGE_SUBTYPE_STOP_SCAN         = 0x04,
	MESSAGE_SUBTYPE_CONNECT_SINK      = 0x05,
	MESSAGE_SUBTYPE_DISCONNECT_SINK   = 0x06,
	MESSAGE_SUBTYPE_ADD_SOURCE        = 0x07,
	MESSAGE_SUBTYPE_RESET             = 0x2A,

	/* EVT (bit7 = 1) */
	MESSAGE_SUBTYPE_SINK_FOUND        = 0x81,
	MESSAGE_SUBTYPE_SOURCE_FOUND      = 0x82,
	MESSAGE_SUBTYPE_SINK_CONNECTED    = 0x83,
	MESSAGE_SUBTYPE_SINK_DISCONNECTED = 0x84,
	MESSAGE_SUBTYPE_SOURCE_ADDED      = 0x85,

	MESSAGE_SUBTYPE_HEARTBEAT         = 0xFF,
};

struct webusb_message {
	uint8_t type;
	uint8_t sub_type;
	uint8_t seq_no;
	uint16_t length;
	uint8_t payload[];
} __packed;

struct net_buf* message_alloc_tx_message(void);
void send_response(enum message_sub_type stype, uint8_t seq_no, int32_t rc);
void send_event(enum message_sub_type stype, int32_t rc);
void send_net_buf_event(enum message_sub_type stype, struct net_buf *tx_net_buf);
void message_handler(struct webusb_message *msg_ptr, uint16_t msg_length);
void message_handler_init(void);

#endif /* __COMMAND_H__ */
