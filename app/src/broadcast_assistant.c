/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief
 *
 */

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/audio/audio.h>
#include <zephyr/bluetooth/audio/bap.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/byteorder.h>

#include "webusb.h"
#include "message_handler.h"
#include "broadcast_assistant.h"

LOG_MODULE_REGISTER(broadcast_assistant, LOG_LEVEL_INF);

/*#define BROADCAST_ASSISTANT_DEBUG*/

#define BT_NAME_LEN 30
#define INVALID_BROADCAST_ID 0xFFFFFFFFU

enum broadcast_assistant_state {
	BROADCAST_ASSISTANT_STATE_IDLE,
	BROADCAST_ASSISTANT_STATE_SCAN_SOURCE,
	BROADCAST_ASSISTANT_STATE_SCAN_SINK,
};

struct scan_recv_data {
	char bt_name[BT_NAME_LEN];
	char broadcast_name[BT_NAME_LEN];
	uint32_t broadcast_id;
	bool has_bass;
	bool has_pacs;
};

static void broadcast_assistant_discover_cb(struct bt_conn *conn, int err, uint8_t recv_state_count);
static void broadcast_assistant_add_src_cb(struct bt_conn *conn, int err);
static void connected(struct bt_conn *conn, uint8_t err);
static void disconnected(struct bt_conn *conn, uint8_t reason);
static void security_changed_cb(struct bt_conn *conn, bt_security_t level, enum bt_security_err err);
static void restart_scanning_if_needed(void);
static bool device_found(struct bt_data *data, void *user_data);
static bool scan_for_source(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad,
			    struct scan_recv_data *sr_data);
static bool scan_for_sink(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad,
			  struct scan_recv_data *sr_data);
static void scan_recv_cb(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad);
static void scan_timeout_cb(void);

static struct bt_le_scan_cb scan_callbacks = {
	.recv = scan_recv_cb,
	.timeout = scan_timeout_cb,
};

static struct bt_bap_broadcast_assistant_cb broadcast_assistant_callbacks = {
	.discover = broadcast_assistant_discover_cb,
	.add_src = broadcast_assistant_add_src_cb,
};

BT_CONN_CB_DEFINE(conn_callbacks) = {
	.connected = connected,
	.disconnected = disconnected,
	.security_changed = security_changed_cb
};

static struct bt_conn *ba_sink_conn; /* TODO: Make a list of sinks */
static enum broadcast_assistant_state ba_state;


/*
 * Private functions
 */

static void broadcast_assistant_discover_cb(struct bt_conn *conn, int err, uint8_t recv_state_count)
{
	LOG_INF("Broadcast assistant discover callback (%p, %d, %u)", (void *)conn, err, recv_state_count);
	if (err) {
		err = bt_conn_disconnect(conn, BT_HCI_ERR_REMOTE_USER_TERM_CONN);
		if (err) {
			LOG_ERR("Failed to disconnect (err %d)", err);
			send_event(MESSAGE_SUBTYPE_SINK_CONNECTED, -1);
		}

		return;
	}

	/* Succesful connected to sink */
	send_event(MESSAGE_SUBTYPE_SINK_CONNECTED, 0);
	restart_scanning_if_needed();
}

static void broadcast_assistant_add_src_cb(struct bt_conn *conn, int err)
{
	LOG_INF("Broadcast assistant add_src callback (%p, %d)", (void *)conn, err);
	send_event(MESSAGE_SUBTYPE_SOURCE_ADDED, err);
}

static void connected(struct bt_conn *conn, uint8_t err)
{
	LOG_INF("Broadcast assistant connected callback (%p, err:%d)", (void *)conn, err);

	if (conn != ba_sink_conn) {
		return;
	}
	if (err) {
		LOG_ERR("Connected error (err %d)", err);
		bt_conn_unref(ba_sink_conn);
		ba_sink_conn = NULL;
		send_event(MESSAGE_SUBTYPE_SINK_CONNECTED, err);
		restart_scanning_if_needed();
		return;
	}

	/* Connected. Do BAP broadcast assistant discover */
	LOG_INF("Broadcast assistant discover");
	err = bt_bap_broadcast_assistant_discover(ba_sink_conn);
	if (err) {
		LOG_ERR("Broadcast assistant discover (err %d)", err);
		err = bt_conn_disconnect(ba_sink_conn, BT_HCI_ERR_REMOTE_USER_TERM_CONN);
		if (err) {
			LOG_ERR("Failed to disconnect (err %d)", err);
			send_event(MESSAGE_SUBTYPE_SINK_CONNECTED, -1);
		}
		restart_scanning_if_needed();
	}
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
	LOG_INF("Broadcast assistant disconnected callback (%p, reason:%d)", (void *)conn, reason);

	if (conn != ba_sink_conn) {
		return;
	}

	bt_conn_unref(ba_sink_conn);
	ba_sink_conn = NULL;

	send_event(MESSAGE_SUBTYPE_SINK_DISCONNECTED, reason);
}

static void security_changed_cb(struct bt_conn *conn, bt_security_t level, enum bt_security_err err)
{
	LOG_INF("Broadcast assistant security_changed callback (%p, %d, err:%d)", (void *)conn, level, err);
}

static void restart_scanning_if_needed(void)
{
	int err;

	switch (ba_state) {
	case BROADCAST_ASSISTANT_STATE_SCAN_SOURCE:
	case BROADCAST_ASSISTANT_STATE_SCAN_SINK:
		LOG_INF("Restart scanning");
		err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
		if (err) {
			LOG_ERR("Scanning failed to start (err %d)", err);
			send_event(ba_state == BROADCAST_ASSISTANT_STATE_SCAN_SOURCE
					   ? MESSAGE_SUBTYPE_START_SOURCE_SCAN
					   : MESSAGE_SUBTYPE_START_SINK_SCAN,
				   err);

			ba_state = BROADCAST_ASSISTANT_STATE_IDLE;
		}
		break;
	default:
		break;
	}
}

static bool device_found(struct bt_data *data, void *user_data)
{
	struct scan_recv_data *sr_data = (struct scan_recv_data *)user_data;
	struct bt_uuid_16 adv_uuid;

	switch (data->type) {
	case BT_DATA_NAME_SHORTENED:
	case BT_DATA_NAME_COMPLETE:
		memcpy(sr_data->bt_name, data->data, MIN(data->data_len, BT_NAME_LEN - 1));
		return true;
	case BT_DATA_BROADCAST_NAME:
		memcpy(sr_data->broadcast_name, data->data, MIN(data->data_len, BT_NAME_LEN - 1));
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

		sr_data->broadcast_id = sys_get_le24(data->data + BT_UUID_SIZE_16);
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

			if (bt_uuid_cmp(uuid, BT_UUID_BASS) == 0) {
				sr_data->has_bass = true;
				continue;
			}

			if (bt_uuid_cmp(uuid, BT_UUID_PACS) == 0) {
				sr_data->has_pacs = true;
				continue;
			}
		}
		return true;
	default:
		return true;
	}
}

static bool scan_for_source(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad,
			    struct scan_recv_data *sr_data)
{
	/* Scan for and select Broadcast Source */

	sr_data->broadcast_id = INVALID_BROADCAST_ID;

	/* We are only interested in non-connectable periodic advertisers */
	if ((info->adv_props & BT_GAP_ADV_PROP_CONNECTABLE) != 0 || info->interval == 0) {
		return false;
	}

	bt_data_parse(ad, device_found, (void *)sr_data);

	if (sr_data->broadcast_id != INVALID_BROADCAST_ID) {
		LOG_INF("Broadcast Source Found [name, b_name, b_id] = [\"%s\", \"%s\", 0x%06x]",
			sr_data->bt_name, sr_data->broadcast_name, sr_data->broadcast_id);

		/* TODO: Add support for syncing to the PA and parsing the BASE
		 * in order to obtain the right subgroup information to send to
		 * the sink when adding a broadcast source (see in main function below).
		 */

		return true;
	}

	return false;
}

static bool scan_for_sink(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad,
			  struct scan_recv_data *sr_data)
{
	/* Scan for and connect to Broadcast Sink */

	/* We are only interested in connectable advertisers */
	if ((info->adv_props & BT_GAP_ADV_PROP_CONNECTABLE) == 0) {
		return false;
	}

	bt_data_parse(ad, device_found, (void *)sr_data);

	if (sr_data->has_bass) {
		LOG_INF("Broadcast Sink Found: [\"%s\"]", sr_data->bt_name);

		return true;
	}

	return false;
}

static void scan_recv_cb(const struct bt_le_scan_recv_info *info, struct net_buf_simple *ad)
{
	int err;
	struct webusb_message msg;
	struct net_buf_simple ad_clone;
	struct scan_recv_data sr_data = {0};

	/* For now, just make a copy if we need to send it */
	net_buf_simple_clone(ad, &ad_clone);

	switch (ba_state) {
	case BROADCAST_ASSISTANT_STATE_SCAN_SOURCE:
		if (scan_for_source(info, ad, &sr_data)) {
			/* broadcast source found */
			msg.sub_type = MESSAGE_SUBTYPE_SOURCE_FOUND;
			break; /* send message */
		}
		return;
	case BROADCAST_ASSISTANT_STATE_SCAN_SINK:
		if (scan_for_sink(info, ad, &sr_data)) {
			/* broadcast sink found */
			msg.sub_type = MESSAGE_SUBTYPE_SINK_FOUND;
			break; /* send message */
		}
		return;
	default:
		return;
	}

	msg.type = MESSAGE_TYPE_EVT;
	msg.seq_no = 0;
	msg.length = ad_clone.len;
	memcpy(msg.payload, ad_clone.data, ad_clone.len);

	/* Append data from struct bt_le_scan_recv_info (RSSI, BT addr, ..) */
	/* RSSI */
	msg.payload[msg.length++] = 2;
	msg.payload[msg.length++] = BT_DATA_RSSI;
	msg.payload[msg.length++] = info->rssi;
	/* bt_addr_le */
	if (info->addr->type == BT_ADDR_LE_PUBLIC) {
		msg.payload[msg.length++] = 1 + BT_ADDR_SIZE;
		msg.payload[msg.length++] = BT_DATA_PUB_TARGET_ADDR;
		memcpy(&msg.payload[msg.length], &info->addr->a, sizeof(bt_addr_t));
		msg.length += sizeof(bt_addr_t);

	} else if (info->addr->type == BT_ADDR_LE_RANDOM) {
		msg.payload[msg.length++] = 1 + BT_ADDR_SIZE;
		msg.payload[msg.length++] = BT_DATA_RAND_TARGET_ADDR;
		memcpy(&msg.payload[msg.length], &info->addr->a, sizeof(bt_addr_t));
		msg.length += sizeof(bt_addr_t);
	}

	if (ba_state == BROADCAST_ASSISTANT_STATE_SCAN_SOURCE) {
		/* sid */
		msg.payload[msg.length++] = 2;
		msg.payload[msg.length++] = BT_DATA_SID;
		msg.payload[msg.length++] = info->sid;
		/* pa interval */
		msg.payload[msg.length++] = 3;
		msg.payload[msg.length++] = BT_DATA_PA_INTERVAL;
		sys_put_le16(info->interval, &msg.payload[msg.length]);
		msg.length += 2;
		/* broadcast id */
		msg.payload[msg.length++] = 5;
		msg.payload[msg.length++] = BT_DATA_BROADCAST_ID;
		sys_put_le32(sr_data.broadcast_id, &msg.payload[msg.length]);
		msg.length += 4;
	}

#ifdef BROADCAST_ASSISTANT_DEBUG
	char log_str[256] = {0};
	uint8_t *payload_ptr = &msg.payload[0];

	/* Show message payload */
	for (int i = 0; i < msg.length;) {
		uint8_t len = *payload_ptr++;
		char *ch_ptr = &log_str[0];

		/* length */
		sprintf(ch_ptr, "[ L:%02x ", len);
		ch_ptr += 7;
		if (len > 0) {
			/* type */
			sprintf(ch_ptr, "T:%02x ", *payload_ptr++);
			ch_ptr += 5;
			if (len > 1) {
				/* value */
				for (int j = 1; j < len; j++) {
					sprintf(ch_ptr, "%02x ", *payload_ptr++);
					ch_ptr += 3;
				}
			}
		}
		sprintf(ch_ptr, "]");
		ch_ptr += 1;
		i += (len + 1);

		LOG_DBG("%s", log_str);
	}
#endif /* BROADCAST_ASSISTANT_DEBUG */

	err = webusb_transmit((uint8_t *)&msg,
			      msg.length + offsetof(struct webusb_message, payload));
	if (err) {
		LOG_ERR("Failed to send sink found evt (err=%d)", err);
	}
}

static void scan_timeout_cb(void)
{
	LOG_INF("Scan timeout");

	switch (ba_state) {
	case BROADCAST_ASSISTANT_STATE_SCAN_SOURCE:
		send_event(MESSAGE_SUBTYPE_START_SOURCE_SCAN, -1);
		break;
	case BROADCAST_ASSISTANT_STATE_SCAN_SINK:
		send_event(MESSAGE_SUBTYPE_START_SINK_SCAN, -1);
		break;
	default:
		break;
	}

	ba_state = BROADCAST_ASSISTANT_STATE_IDLE;
	send_event(MESSAGE_SUBTYPE_STOP_SCAN, 0);
}

/*
 * Public functions
 */

int scan_for_broadcast_source(uint8_t seq_no)
{
	if (ba_state == BROADCAST_ASSISTANT_STATE_IDLE) {
		int err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
		if (err) {
			LOG_ERR("Scanning failed to start (err %d)", err);
			return err;
		}
	}

	LOG_INF("Scanning for Broadcast Source started");

	ba_state = BROADCAST_ASSISTANT_STATE_SCAN_SOURCE;

	return 0;
}

int scan_for_broadcast_sink(uint8_t seq_no)
{
	if (ba_state == BROADCAST_ASSISTANT_STATE_IDLE) {
		int err = bt_le_scan_start(BT_LE_SCAN_PASSIVE, NULL);
		if (err) {
			LOG_ERR("Scanning failed to start (err %d)", err);
			return err;
		}
	}

	LOG_INF("Scanning for Broadcast Sink started");

	ba_state = BROADCAST_ASSISTANT_STATE_SCAN_SINK;

	return 0;
}

int stop_scanning(void)
{
	if (ba_state == BROADCAST_ASSISTANT_STATE_IDLE) {
		/* No scan ongoing */
		return 0;
	}

	int err = bt_le_scan_stop();
	if (err) {
		LOG_ERR("bt_le_scan_stop failed with %d", err);
		return err;
	}

	LOG_INF("Scanning stopped");

	ba_state = BROADCAST_ASSISTANT_STATE_IDLE;

	return 0;
}

static void disconnect(struct bt_conn *conn, void *data)
{
	char addr_str[BT_ADDR_LE_STR_LEN];
	int err;

	bt_addr_le_to_str(bt_conn_get_dst(conn), addr_str, sizeof(addr_str));

	LOG_INF("Disconnecting from %s", addr_str);
	err = bt_conn_disconnect(conn, BT_HCI_ERR_REMOTE_USER_TERM_CONN);
	if (err) {
		LOG_INF("Failed to disconnect from %s", addr_str);
	}
}

int disconnect_unpair_all(void)
{
	int err = 0;

	LOG_INF("Disconnecting and unpairing all devices");

	bt_conn_foreach(BT_CONN_TYPE_LE, disconnect, NULL);

	LOG_INF("Disconnecting complete");

	err = bt_unpair(BT_ID_DEFAULT, NULL);
	if (err) {
		LOG_ERR("bt_unpair failed with %d", err);
	}

	LOG_INF("Unpair complete");

	return 0;
}

int connect_to_sink(bt_addr_le_t *bt_addr_le)
{
	char addr_str[BT_ADDR_LE_STR_LEN];
	int err;

	if (ba_sink_conn) {
		/* Sink already connected. TODO: Support multiple sinks*/
		return -EAGAIN;
	}

	/* Stop scanning if needed */
	switch (ba_state) {
	case BROADCAST_ASSISTANT_STATE_SCAN_SOURCE:
	case BROADCAST_ASSISTANT_STATE_SCAN_SINK:
		LOG_INF("Stop scanning");
		err = bt_le_scan_stop();
		if (err) {
			LOG_ERR("bt_le_scan_stop failed %d", err);
			return err;
		}
		break;
	default:
		break;
	}

	bt_addr_le_to_str(bt_addr_le, addr_str, sizeof(addr_str));
	LOG_INF("Connecting to %s...", addr_str);

	err = bt_conn_le_create(bt_addr_le, BT_CONN_LE_CREATE_CONN, BT_LE_CONN_PARAM_DEFAULT,
				&ba_sink_conn);
	if (err) {
		LOG_ERR("Failed creating connection (err=%d)", err);
		restart_scanning_if_needed();

		return err;
	}

	return 0;
}

int disconnect_from_sink(bt_addr_le_t *bt_addr_le)
{
	char addr_str[BT_ADDR_LE_STR_LEN];
	int err;

	bt_addr_le_to_str(bt_addr_le, addr_str, sizeof(addr_str));
	LOG_INF("Disconnecting from %s...", addr_str);

	/* TODO: Support multiple sinks. Search for conn to disconnect via
	 * bt_conn_foreach(BT_CONN_TYPE_LE, disconnect, NULL).
	 */
	if (ba_sink_conn) {
		err = bt_conn_disconnect(ba_sink_conn, BT_HCI_ERR_REMOTE_USER_TERM_CONN);
		if (err) {
			LOG_ERR("Failed to disconnect (err %d)", err);
			send_event(MESSAGE_SUBTYPE_SINK_DISCONNECTED, -1);
		}
	}

	return 0;
}

int add_source(uint8_t sid, uint16_t pa_interval, uint32_t broadcast_id, bt_addr_le_t *addr)
{
	LOG_INF("Adding broadcast source...");

	struct bt_bap_scan_delegator_subgroup subgroup = {0};
	struct bt_bap_broadcast_assistant_add_src_param param = {0};
	int err = 0;

	subgroup.bis_sync = BT_BAP_BIS_SYNC_NO_PREF; /* We might want to hard code to BIT(1) */

	bt_addr_le_copy(&param.addr, addr);
	param.adv_sid = sid;
	param.pa_interval = pa_interval;
	param.broadcast_id = broadcast_id;
	param.pa_sync = true;

	LOG_INF("adv_sid = %u, pa_interval = %u, broadcast_id = 0x%08x", param.adv_sid,
		param.pa_interval, param.broadcast_id);

	param.num_subgroups = 1;
	param.subgroups = &subgroup;

	if (!ba_sink_conn) {
		LOG_INF("No sink connected!");
		return -ENOTCONN;
	}

	err = bt_bap_broadcast_assistant_add_src(ba_sink_conn, &param);
	if (err != 0) {
		LOG_ERR("Failed to add source (err %d)", err);
		return err;
	}

	return 0;
}

int broadcast_assistant_init(void)
{
	ba_sink_conn = NULL;

	int err = bt_enable(NULL);
	if (err) {
		LOG_ERR("Bluetooth init failed (err %d)", err);
		return err;
	}

	LOG_INF("Bluetooth initialized");

	bt_le_scan_cb_register(&scan_callbacks);
	bt_bap_broadcast_assistant_register_cb(&broadcast_assistant_callbacks);
	LOG_INF("Bluetooth scan callback registered");

	ba_state = BROADCAST_ASSISTANT_STATE_IDLE;

	return 0;
}
