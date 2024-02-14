// @ts-check

import { arrayToMsg, msgToArray, MessageType, MessageSubType } from '../lib/message.js';
import { cobsEncode, cobsDecode } from '../lib/cobs.js';

/**
* WebUSB Device Service
*
* Handles USB communication and COBS encoding/decoding of messages
*
* (Early draft)
*
*/

const deviceFilter = { 'vendorId': 0x2fe3, 'productId': 0x00a };

const MAX_BYTES_READ = 4096;

export const WebUSBDeviceService = new class extends EventTarget {
	#device

	constructor() {
		super();

		this.scan = this.scan.bind(this);
		this.sendCMD = this.sendCMD.bind(this);
		this.sendData = this.sendData.bind(this);
	}

	scan() {
		navigator.usb.requestDevice({ filters: [deviceFilter] })
		.then(selectedDevice => {
			this._openDevice(selectedDevice);
		})
		.catch(error => { console.log(error); });
	}

	readLoop() {
		const {
			endpointNumber
		} = this.#device.configuration.interfaces[0].alternate.endpoints[0]
		this.#device.transferIn(endpointNumber, MAX_BYTES_READ).then(result => {
			const buf = new Uint8Array(result.data.buffer);

			console.log('from usb:', buf);
			this.dispatchEvent(new CustomEvent('raw-data-received', {detail: { buf }}));

			// decode to message
			let decoded = cobsDecode(buf, true);
			const message = arrayToMsg(decoded);
			this.dispatchEvent(new CustomEvent('message', {detail: { message }}));

			this.readLoop();
		}, error => {
			console.log('error', error);
		});
	}

	sendData(data) {
		console.log(`Sending ${data.length} bytes to USB:`, data);

		if (!this.#device) {
			console.log('Device not connected...');
			return;
		}

		const {
			endpointNumber
		} = this.#device.configuration.interfaces[0].alternate.endpoints[1]
		return this.#device.transferOut(endpointNumber, data);
	}

	sendCMD(message) {
		let arrayIn = msgToArray(message);
		let encoded = cobsEncode(arrayIn, true);

		this.sendData(encoded)
	}

	async _openDevice(device) {
		await device.open()
		if (device.configuration === null) {
			return device.selectConfiguration(1);
		}

		await device.claimInterface(0);

		this.#device = device;

		this.dispatchEvent(new CustomEvent('connected', { detail: { device }}));

		//console.log('device opened', this.#device)
		this.readLoop();
	}
}
