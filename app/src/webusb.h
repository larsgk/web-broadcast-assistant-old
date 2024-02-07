/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief WebUSB enabled custom class driver header file
 *
 * Header file for WebUSB enabled custom class driver
 */

#ifndef __WEBUSB_SERIAL_H__
#define __WEBUSB_SERIAL_H__

/**
 * @brief Initializes WebUSB component
 *
 */
void webusb_init(void);

/**
 * @brief Transmits a USB package
 *
 */
int webusb_transmit(uint8_t *data, uint16_t size);

/**
 * @brief Register command handler callback
 *
 * Function to register command handler callback
 * for handling device command.
 *
 * @param [in] handlers Pointer to WebUSB command handler structure
 */
void webusb_register_command_handler(void (*webusb_cmd_handler)(uint8_t *command_ptr, uint16_t command_length));

#endif /* __WEBUSB_SERIAL_H__ */
