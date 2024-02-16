// @ts-check

import {
	MessageType,
	MessageSubType,
	BT_DataType,
	ltvToArray,
	ltvArrayFindValue
} from '../lib/message.js';

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

	handleSourceFound(message) {
		console.log(`Handle found Source`);

		const payloadArray = ltvToArray(message.payload);
		console.log('Payload', payloadArray);

		const source = {
			name: ltvArrayFindValue(payloadArray, [
				BT_DataType.BT_DATA_NAME_SHORTENED,
				BT_DataType.BT_DATA_NAME_COMPLETE
			])?.value || "UNKNOWN",
			broadcast_name: ltvArrayFindValue(payloadArray, [
				BT_DataType.BT_DATA_BROADCAST_NAME
			])?.value || "Unknown Broadcast",
			rssi: ltvArrayFindValue(payloadArray, [
				BT_DataType.BT_DATA_RSSI
			])?.value || "Unknown RSSI"
		}

		// If device already exists, just update RSSI, otherwise add to list
		let device = this.#sources.find(_source => _source.broadcast_id === _source.broadcast_name);
		if (!device) {
			// This is a new element
			this.#sources.push(source)
		} else {
			// This device is already saved, update rssi
			device.rssi = source.rssi;
		}

		this.dispatchEvent(new CustomEvent('source-found', {detail: { source }}));
	}

	handleSinkFound(message) {
		console.log(`Handle found Sink`);

		const payloadArray = ltvToArray(message.payload);
		console.log('Payload', payloadArray);

		// Find a name and add that (alone) to the sink device
		// TODO: if sink is already in the list, just update, e.g. RSSI
		const sink = {
			name: ltvArrayFindValue(payloadArray, [
				BT_DataType.BT_DATA_NAME_SHORTENED,
				BT_DataType.BT_DATA_NAME_COMPLETE
			])?.value || "UNKNOWN",
			uuid16s: ltvArrayFindValue(payloadArray, [
				BT_DataType.BT_DATA_UUID16_ALL,
				BT_DataType.BT_DATA_UUID16_SOME,
			])?.value || []
		}

		// Add to source device list
		let sinkInList = this.#sinks.find(_sink => _sink.name === sink.name);
		if (!sinkInList) {
			this.#sinks.push(sinkInList)
		} else {
			// TODO: This device is already saved, update rssi
		}

		this.dispatchEvent(new CustomEvent('sink-found', {detail: { sink }}));
	}

	handleRES(msg) {
		console.log(`Response message ${msg.type}`);
	}

	handleEVT(message) {
		console.log(`Event with subType ${message.subType}`);

		switch (message.subType) {
			case MessageSubType.SINK_FOUND:
			this.handleSinkFound(message);
			break;
			case MessageSubType.SOURCE_FOUND:
			this.handleSourceFound(message);
			break;
			default:
			console.log(`Could not interpret event with subType ${message.subType}`);
		}
	}

	serviceMessageHandler(evt) {
		const { message } = evt.detail;

		if (!message) {
			console.warn("No message in event!");
			return;
		}

		if (message.type !== MessageType.EVT && message.type !== MessageType.RES) {
			console.log(`Unknown message type ${message.type}`);
			return;
		}

		switch (message.type) {
			case MessageType.RES:
			this.handleRES(message);
			break;
			case MessageType.EVT:
			this.handleEVT(message);
			break;
			default:
			console.log(`Could not interpret message with type ${message.type}`);
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
