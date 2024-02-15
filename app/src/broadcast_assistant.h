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

#define BT_DATA_RSSI (BT_DATA_MANUFACTURER_DATA - 1)

void scan_for_broadcast_source(uint8_t seq_no);
void scan_for_broadcast_sink(uint8_t seq_no);
void stop_scanning(uint8_t seq_no);
void broadcast_assistant_init(void);

#endif /* __BROADCAST_ASSISTANT_H__ */
