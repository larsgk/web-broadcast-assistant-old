/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief
 *
 */

#ifndef __BROADCAST_ASSISTANT_H__
#define __BROADCAST_ASSISTANT_H__

#include <zephyr/types.h>
#include <zephyr/bluetooth/gap.h>

#define BT_DATA_RSSI         (BT_DATA_MANUFACTURER_DATA - 1)
#define BT_DATA_SID          (BT_DATA_MANUFACTURER_DATA - 2)
#define BT_DATA_PA_INTERVAL  (BT_DATA_MANUFACTURER_DATA - 3)
#define BT_DATA_ERROR_CODE   (BT_DATA_MANUFACTURER_DATA - 4)
#define BT_DATA_BROADCAST_ID (BT_DATA_MANUFACTURER_DATA - 5)

int scan_for_broadcast_source(uint8_t seq_no);
int scan_for_broadcast_sink(uint8_t seq_no);
int stop_scanning(void);
int connect_to_sink(uint8_t seq_no, uint16_t msg_length, uint8_t *payload);
int broadcast_assistant_init(void);
int disconnect_unpair_all(void);

#endif /* __BROADCAST_ASSISTANT_H__ */
