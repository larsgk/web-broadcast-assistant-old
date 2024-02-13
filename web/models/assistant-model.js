// @ts-check

import { parseLTV, MessageType, MessageSubType } from '../lib/message.js';

/**
* Assistant Model
*
* Keeps state info on sources & sinks
* Handles commands, responses and events
*
*/

/**
 * Source device structure
 *
 * {
 * 	bt_name: string | undefined,
 * 	broadcast_name: string | undefined
 * 	broadcast_id: uint24, (UNIQUE IDENTIFIER)
 * 	rssi: int8
 * }
 *
 * Sink device structure
 *
 * {
 * 	bt_addr: string | undefined, (UNIQUE IDENTIFIER)
 * 	bt_name: string | undefined,
 * 	connection_state: boolean,
 * 	security_level: uint8,
 * 	bass_state: idle | configured | streaming,
 * 	broadcast_id: uint24,
 * 	rssi: int8
 * }
 */

export class AssistantModel extends EventTarget {
	#service
	#sinks
	#sources

	constructor(service) {
		super();

		this.#service = service;
		this.#sinks = [];
		this.#sources = [];

		this.serviceMessageHandler = this.serviceMessageHandler.bind(this);

		this.addListeners();
	}

	addListeners() {
		this.#service.addEventListener('connected', evt => {
			console.log('AssistantModel registered Service as connected');
			this.serviceIsConnected = true;
		});
		this.#service.addEventListener('disconnected', evt => {
			console.log('AssistantModel registered Service as disconnected');
			this.serviceIsConnected = false;
		});
		this.#service.addEventListener('message', this.serviceMessageHandler);
	}

	handleSourceFound(data) {
		console.log(`Handle found Source`);
		console.log(`Payload:${data}`);

		let scanData = parseLTV(data)

		if (!('broadcast_id' in scanData)) {
			console.log('Invalid scan data, no broadcast_id present')
			return;
		}

		// If existing, just update RSSI, otherwise add to list
		let sourceDevice = this.#sources.find(sink => sink.broadcast_id === scanData.broadcast_id);
		if (!sourceDevice) {
			// This is a new element
			this.#sources.push(scanData)
		} else {
			// This device is already saved, update rssi
			sourceDevice.rssi = scanData.rssi;
		}

		this.dispatchEvent(new CustomEvent('sink-updated', {detail: sourceDevice}));
	}

	handleSinkFound(data) {
		console.log(`Handle found Sink`);
		console.log(`Payload:${data}`);

		let scanData = parseLTV(data)

		if (!('bt_addr' in scanData)) {
			console.log('Invalid scan data, no bt_addr present')
			return;
		}

		// If existing, just update RSSI, otherwise add to list
		let sinkDevice = this.#sinks.find(sink => sink.bt_addr === scanData.bt_addr);
		if (!sinkDevice) {
			// This is a new element
			this.#sinks.push(scanData)
		} else {
			// This device is already saved, update rssi
			sinkDevice.rssi = scanData.rssi;
		}

		this.dispatchEvent(new CustomEvent('sink-updated', {detail: sinkDevice}));
	}

	handleCMD(cmd) {
		console.log(`Command with subType ${cmd.subType}`);

		switch (cmd.subType) {
			case MessageSubType.START_SINK_SCAN:
			this.startSinkScan();
			break;
			case MessageSubType.START_SOURCE_SCAN:
			this.startSourceScan();
			case MessageSubType.STOP_SCAN:
			this.stopScan();
			break;
			default:
			console.log(`Could not interpret command with subType ${cmd.subType}`);
		}
	}

	handleRES(msg) {
		console.log(`Response message ${msg.type}`);
	}

	handleEVT(evt) {
		console.log(`Event with subType ${evt.subType}`);

		switch (evt.subType) {
			case MessageSubType.SINK_FOUND:
			this.handleSinkFound(evt.payload);
			break;
			case MessageSubType.SOURCE_FOUND:
			this.handleSourceFound(evt.payload);
			break;
			default:
			console.log(`Could not interpret event with subType ${evt.subType}`);
		}
	}

	serviceMessageHandler(msg) {
		console.log(`Received event ${msg} in serviceMessageHandler`);

		if (msg.type.localeCompare("message") != 0) {
			console.log(`Unknown event type ${msg.type}`);
			return;
		}

		switch (msg.detail.message.type) {
			case MessageType.CMD:
			this.handleCMD(msg.detail.message);
			break;
			case MessageType.RES:
			this.handleRES(msg.detail.message);
			break;
			case MessageType.EVT:
			this.handleEVT(msg.detail.message);
			break;
			default:
			console.log(`Could not interpret message with type ${msg.detail.message.type}`);
		}
	}

	startSinkScan() {
		console.log("Sending Start Sink Scan CMD")

		// Just placeholders, this is not how components should work
		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.START_SINK_SCAN,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.#service.sendCMD(message)
	}

	startSourceScan() {
		console.log("Sending Start Source Scan CMD")

		// Just placeholders, this is not how components should work
		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.START_SOURCE_SCAN,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.#service.sendCMD(message)
	}

	stopScan() {
		console.log("Sending Stop Scan CMD")

		// Just placeholders, this is not how components should work
		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.STOP_SCAN,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.#service.sendCMD(message)
	}

}

let _instance = null;

export const initializeAssistantModel = deviceService => {
        if (!_instance) {
                _instance = new AssistantModel(deviceService);
        }
}

export const getInstance = () => {
        if (!_instance) {
                throw Error("AssistantModel not instantiated...");
        }
        return _instance;
}
