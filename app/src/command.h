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

#define MAX_MSG_PAYLOAD_LEN 1024

enum message_type {
	MESSAGE_TYPE_CMD = 1,
	MESSAGE_TYPE_RES,
	MESSAGE_TYPE_EVT,
};

enum message_sub_type {
	/* CMD/RES (bit7 = 0) */
	MESSAGE_SUBTYPE_START_SINK_SCAN   = 0x01,
	MESSAGE_SUBTYPE_START_SOURCE_SCAN = 0x02,
	MESSAGE_SUBTYPE_STOP_SCAN         = 0x03,

	MESSAGE_SUBTYPE_DUMMY             = 0x7F,

	/* EVT (bit7 = 1) */
	MESSAGE_SUBTYPE_SINK_FOUND        = 0x81,
	MESSAGE_SUBTYPE_SOURCE_FOUND      = 0x82,

	MESSAGE_SUBTYPE_HEARTBEAT         = 0xFF,
};

struct command_message {
	uint8_t type;
	uint8_t sub_type;
	uint8_t seq_no;
	uint16_t length;
	uint8_t payload[MAX_MSG_PAYLOAD_LEN];
} __packed;

void send_ok_response(void);
void send_dummy_response(uint8_t seq_no);
void send_response(enum message_sub_type type, uint8_t seq_no);
void send_error_response(void);
void command_handler(struct command_message *command_ptr, uint16_t command_length);
void command_init(void);

#endif /* __COMMAND_H__ */
