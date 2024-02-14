/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief
 *
 */

//#include <zephyr/types.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/audio/audio.h>
#include <zephyr/logging/log.h>

#include <zephyr/sys/byteorder.h>

#include "webusb.h"
#include "command.h"
#include "broadcast_assistant.h"

LOG_MODULE_REGISTER(broadcast_assistant, LOG_LEVEL_INF);

#define BT_NAME_LEN 30
#define INVALID_BROADCAST_ID 0xFFFFFFFFU

static bool scanning_for_broadcast_source;

static void scan_recv_cb(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad);
static void scan_timeout_cb(void);

static struct bt_le_scan_cb scan_callbacks = {
	.recv = scan_recv_cb,
	.timeout = scan_timeout_cb,
};

struct scan_recv_info {
	char bt_name[BT_NAME_LEN];
	char broadcast_name[BT_NAME_LEN];
	uint32_t broadcast_id;
	bool has_bass;
	bool has_pacs;
};

/*
 * Private functions
 */

static bool device_found(struct bt_data *data, void *user_data)
{
	struct scan_recv_info *sr_info = (struct scan_recv_info *)user_data;
	struct bt_uuid_16 adv_uuid;

	switch (data->type) {
	case BT_DATA_NAME_SHORTENED:
	case BT_DATA_NAME_COMPLETE:
		memcpy(sr_info->bt_name, data->data, MIN(data->data_len, BT_NAME_LEN - 1));
		return true;
	case BT_DATA_BROADCAST_NAME:
		memcpy(sr_info->broadcast_name, data->data, MIN(data->data_len, BT_NAME_LEN - 1));
		return true;
	case BT_DATA_SVC_DATA16:
	/* TODO: Test code bolow before enable */
#if 0
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
#endif /* 0 */

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
			LOG_ERR("UUID16 AD malformed\n");
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

static void scan_recv_cb(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad)
{
	int err;
	struct scan_recv_info sr_info = {0};
	struct command_message msg;

	LOG_DBG("scan cb...");

	if (scanning_for_broadcast_source) {
		/* Scan for and select Broadcast Source */

		sr_info.broadcast_id = INVALID_BROADCAST_ID;

		/* We are only interested in non-connectable periodic advertisers */
		if ((info->adv_props & BT_GAP_ADV_PROP_CONNECTABLE) != 0 || info->interval == 0) {
			LOG_DBG("Connectable...");
			return;
		}

		LOG_DBG("...maybe broadcast");

		/* For now, just make a copy if we need to send it */
		struct net_buf_simple buf_copy;
		net_buf_simple_clone(ad, &buf_copy);

		bt_data_parse(ad, device_found, (void *)&sr_info);

		if (sr_info.broadcast_id != INVALID_BROADCAST_ID) {
			LOG_INF("Broadcast Source Found:");
			LOG_INF("[name, br_name, br_id] = [\"%s\", \"%s\", 0x%06x]",
				sr_info.bt_name, sr_info.broadcast_name, sr_info.broadcast_id);

			/* Send the full advertising result */

			// TBD: the netbuf clone is used here
			msg.type = MESSAGE_TYPE_EVT;
			msg.sub_type = MESSAGE_SUBTYPE_SOURCE_FOUND;
			msg.seq_no = 0;
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
			LOG_INF("Broadcast Sink Found: [%s]", sr_info.bt_name);
			LOG_DBG("buf %p, len %d", buf_copy.data, buf_copy.len);

			/* Send the full advertising result */

			// TBD: the netbuf clone is used here
			msg.type = MESSAGE_TYPE_EVT;
			msg.sub_type = MESSAGE_SUBTYPE_SINK_FOUND;
			msg.seq_no = 0;
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
	LOG_INF("Scan timeout");
}

/*
 * Public functions
 */

void scan_for_broadcast_source(uint8_t seq_no)
{
	int err;

	scanning_for_broadcast_source = true;

	err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
	if (err) {
		LOG_ERR("Scanning failed to start (err %d)\n", err);
		return;
	}

	LOG_INF("Scanning for Broadcast Source successfully started");
	send_response(MESSAGE_SUBTYPE_START_SOURCE_SCAN, seq_no);
}

void scan_for_broadcast_sink(uint8_t seq_no)
{
	int err;

	scanning_for_broadcast_source = false;

	err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
	if (err) {
		LOG_ERR("Scanning failed to start (err %d)", err);
		return;
	}

	LOG_INF("Scanning for Broadcast Sink started");
	send_response(MESSAGE_SUBTYPE_START_SINK_SCAN, seq_no);
}

void stop_scanning(uint8_t seq_no)
{
	int err = bt_le_scan_stop();
	if (err != 0) {
		LOG_ERR("bt_le_scan_stop failed with %d", err);
	}

	send_response(MESSAGE_SUBTYPE_STOP_SCAN, seq_no);
}

void broadcast_assistant_init(void)
{
	int err = bt_enable(NULL);
	if (err) {
		LOG_ERR("Bluetooth init failed (err %d)", err);
		return;
	}

	LOG_INF("Bluetooth initialized");

	bt_le_scan_cb_register(&scan_callbacks);
	LOG_INF("Bluetooth scan callback registered");
}
