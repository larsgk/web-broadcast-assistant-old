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

/* TODO: Move Bluetooth functionality to separate module/file */
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/audio/audio.h>
#include <zephyr/bluetooth/audio/bap.h>
#include <zephyr/sys/byteorder.h>

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
	MESSAGE_SUBTYPE_STOP_SCAN		= 0x03,

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

void send_response(enum MessageSubType type, uint8_t seq_no)
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

struct TmpMessage {
	uint8_t type;
	uint8_t subType;
	uint8_t seqNo;
	uint16_t length;
	uint8_t payload[1024];
} __packed;

/* Bluetooth functions below (should be moved to separate module/file) */
#define NAME_LEN 30
#define INVALID_BROADCAST_ID 0xFFFFFFFFU

static bool scanning_for_broadcast_source;

struct scan_recv_info {
	char bt_name[NAME_LEN];
	char broadcast_name[NAME_LEN];
	uint32_t broadcast_id;
	bool has_bass;
	bool has_pacs;
};

static bool device_found(struct bt_data *data, void *user_data)
{
	struct scan_recv_info *sr_info = (struct scan_recv_info *)user_data;
	struct bt_uuid_16 adv_uuid;

	switch (data->type) {
	case BT_DATA_NAME_SHORTENED:
	case BT_DATA_NAME_COMPLETE:
		memcpy(sr_info->bt_name, data->data, MIN(data->data_len, NAME_LEN - 1));
		return true;
	case BT_DATA_BROADCAST_NAME:
		memcpy(sr_info->broadcast_name, data->data, MIN(data->data_len, NAME_LEN - 1));
		return true;
	case BT_DATA_SVC_DATA16:
		/* Check for BASS in Service Data */
		if (data->data_len >= BT_UUID_SIZE_16) {
			const struct bt_uuid *uuid;
			uint16_t u16;

			memcpy(&u16, data->data, sizeof(u16));
			uuid = BT_UUID_DECLARE_16(sys_le16_to_cpu(u16));

			if (bt_uuid_cmp(uuid, BT_UUID_BASS)) {
				sr_info->has_bass = true;
				return true;
			}
		}

		/* Check for Broadcast ID */
		if (data->data_len < BT_UUID_SIZE_16 + BT_AUDIO_BROADCAST_ID_SIZE) {
			return true;
		}

		if (!bt_uuid_create(&adv_uuid.uuid, data->data, BT_UUID_SIZE_16)) {
			return true;
		}

		if (bt_uuid_cmp(&adv_uuid.uuid, BT_UUID_BROADCAST_AUDIO) != 0) {
			return true;
		}

		sr_info->broadcast_id = sys_get_le24(data->data + BT_UUID_SIZE_16);
		return true;
	case BT_DATA_UUID16_SOME:
	case BT_DATA_UUID16_ALL:
		/* NOTE: According to the BAP 1.0.1 Spec,
		 * Section 3.9.2. Additional Broadcast Audio Scan Service requirements,
		 * If the Scan Delegator implements a Broadcast Sink, it should also
		 * advertise a Service Data field containing the Broadcast Audio
		 * Scan Service (BASS) UUID.
		 *
		 * However, it seems that this is not the case with the sinks available
		 * while developing this sample application.  Therefore, we instead,
		 * search for the existence of BASS and PACS in the list of service UUIDs,
		 * which does seem to exist in the sinks available.
		 */

		/* Check for BASS and PACS */
		if (data->data_len % sizeof(uint16_t) != 0U) {
			printk("UUID16 AD malformed\n");
			return true;
		}

		for (size_t i = 0; i < data->data_len; i += sizeof(uint16_t)) {
			const struct bt_uuid *uuid;
			uint16_t u16;

			memcpy(&u16, &data->data[i], sizeof(u16));
			uuid = BT_UUID_DECLARE_16(sys_le16_to_cpu(u16));

			if (bt_uuid_cmp(uuid, BT_UUID_BASS)) {
				sr_info->has_bass = true;
				continue;
			}

			if (bt_uuid_cmp(uuid, BT_UUID_PACS)) {
				sr_info->has_pacs = true;
				continue;
			}
		}
		return true;
	default:
		return true;
	}
}

static struct TmpMessage msg = {0};

static void scan_recv_cb(const struct bt_le_scan_recv_info *info,
			 struct net_buf_simple *ad)
{
	int err;
	struct scan_recv_info sr_info = {0};


	LOG_DBG("scan cb...");

	if (scanning_for_broadcast_source) {
		/* Scan for and select Broadcast Source */

		sr_info.broadcast_id = INVALID_BROADCAST_ID;

		/* We are only interested in non-connectable periodic advertisers */
		if ((info->adv_props & BT_GAP_ADV_PROP_CONNECTABLE) != 0 ||
		    info->interval == 0) {
			LOG_DBG("Connectable...");
			return;
		}

		LOG_DBG("...maybe broadcast");

		/* For now, just make a copy if we need to send it */
		struct net_buf_simple buf_copy;
		net_buf_simple_clone(ad, &buf_copy);

		bt_data_parse(ad, device_found, (void *)&sr_info);

		if (sr_info.broadcast_id != INVALID_BROADCAST_ID) {
			printk("Broadcast Source Found:\n");
			printk("  BT Name:        %s\n", sr_info.bt_name);
			printk("  Broadcast Name: %s\n", sr_info.broadcast_name);
			printk("  Broadcast ID:   0x%06x\n\n", sr_info.broadcast_id);

			/* Send the full advertising result */

			// TBD: the netbuf clone is used here
			msg.type = MESSAGE_TYPE_EVT;
			msg.subType = MESSAGE_SUBTYPE_SOURCE_FOUND;
			msg.seqNo = 0;
			msg.length = buf_copy.len;
			memcpy(msg.payload, buf_copy.data, buf_copy.len);

			err = webusb_transmit((uint8_t*)&msg, buf_copy.len + 5);
			if (err != 0) {
				LOG_ERR("FAILED TO SEND Source Found EVT (err=%d)", err);
			}

			/* TODO: Also, we need to add the following information for
			 * bt_bap_broadcast_assistant_add_src
			 */

			/* selected_broadcast_id = sr_info.broadcast_id;
			selected_sid = info->sid;
			selected_pa_interval = info->interval;
			bt_addr_le_copy(&selected_addr, info->addr); */

			/* TODO: Add support for syncing to the PA and parsing the BASE
			 * in order to obtain the right subgroup information to send to
			 * the sink when adding a broadcast source (see in main function below).
			 */

		}
	} else {
		/* Scan for and connect to Broadcast Sink */

		/* We are only interested in connectable advertisers */
		if ((info->adv_props & BT_GAP_ADV_PROP_CONNECTABLE) == 0) {
			return;
		}

		/* For now, just make a copy if we need to send it */
		struct net_buf_simple buf_copy;
		net_buf_simple_clone(ad, &buf_copy);

		bt_data_parse(ad, device_found, (void *)&sr_info);

		if (sr_info.has_bass) {
			printk("Broadcast Sink Found:\n");
			printk("  BT Name:        %s\n", sr_info.bt_name);
			printk("  BUF      %p  %d\n", buf_copy.data, buf_copy.len);

			/* Send the full advertising result */

			// TBD: the netbuf clone is used here
			msg.type = MESSAGE_TYPE_EVT;
			msg.subType = MESSAGE_SUBTYPE_SINK_FOUND;
			msg.seqNo = 0;
			msg.length = buf_copy.len;
			memcpy(msg.payload, buf_copy.data, buf_copy.len);

			err = webusb_transmit((uint8_t*)&msg, buf_copy.len + 5);
			if (err != 0) {
				LOG_ERR("FAILED TO SEND Sink Found EVT (err=%d)", err);
			}

		}
	}
}

static void scan_timeout_cb(void)
{
	printk("Scan timeout\n");
}

static struct bt_le_scan_cb scan_callbacks = {
	.recv = scan_recv_cb,
	.timeout = scan_timeout_cb,
};

static void scan_for_broadcast_source(uint8_t seq_no)
{
	int err;

	scanning_for_broadcast_source = true;

	err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
	if (err) {
		printk("Scanning failed to start (err %d)\n", err);
		return;
	}

	printk("Scanning for Broadcast Source successfully started\n");
	send_response(MESSAGE_SUBTYPE_START_SOURCE_SCAN, seq_no);
}

static void scan_for_broadcast_sink(uint8_t seq_no)
{
	int err;

	scanning_for_broadcast_source = false;

	err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
	if (err) {
		printk("Scanning failed to start (err %d)\n", err);
		return;
	}

	printk("Scanning for Broadcast Sink successfully started\n");
	send_response(MESSAGE_SUBTYPE_START_SINK_SCAN, seq_no);
}


static void stop_scanning(uint8_t seq_no)
{
	int err = bt_le_scan_stop();
	if (err != 0) {
		printk("bt_le_scan_stop failed with %d\n", err);
	}

	send_response(MESSAGE_SUBTYPE_STOP_SCAN, seq_no);
}

/* Bluetooth functions above ... */

void command_handler(uint8_t *command_ptr, uint16_t command_length)
{
	// MISSING PARSING OF COMMANDS AND DEFINITIONS OF THOSE !!!!
	uint8_t msg_type = command_ptr[0];
	uint8_t msg_sub_type = command_ptr[1];
	uint8_t msg_seq_no = command_ptr[2];
	#define ON 1

\
	switch (msg_sub_type) {
		case MESSAGE_SUBTYPE_HEARTBEAT:
			if (ON) {
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

	/* Bluetooth initialization */
	ret = bt_enable(NULL);
	if (ret) {
		printk("Bluetooth init failed (err %d)\n", ret);
		return 0;
	}

	printk("Bluetooth initialized\n");
	bt_le_scan_cb_register(&scan_callbacks);

	return 0;
}
