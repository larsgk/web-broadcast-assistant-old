/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file
 * @brief Sample app for a WebUSB Broadcast Assistant
 */

#include <zephyr/usb/usb_device.h>

#include "webusb.h"
#include "msosv2.h"
#include "broadcast_assistant.h"
#include "command.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

int main(void)
{
	int ret;

	LOG_INF("web-broadcast-assistants starting");

	/* Initialize WebUSB component */
	msosv2_init();
	webusb_init();

	/* Set the command handler */
	webusb_register_command_handler(&command_handler);

	command_init();

	ret = usb_enable(NULL);
	if (ret != 0) {
		LOG_ERR("Failed to enable USB");
		return 0;
	}

	/* Bluetooth initialization */
	broadcast_assistant_init();

	return 0;
}
