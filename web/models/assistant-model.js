// @ts-check

import {
	MessageType,
	MessageSubType,
	BT_DataType,
	ltvToTvArray,
	tvArrayToLtv,
	tvArrayFindItem
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

		const payloadArray = ltvToTvArray(message.payload);
		// console.log('Payload', payloadArray);

		const addr = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_PUB_TARGET_ADDR,
			BT_DataType.BT_DATA_RAND_TARGET_ADDR
		]);

		if (!addr) {
			// TBD: Throw exception?
			return;
		}

		const rssi = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_RSSI
		])?.value;

		// TODO: Handle Broadcast ID parsing in message.js and attach to 'source'

		// If device already exists, just update RSSI, otherwise add to list
		let source = this.#sources.find(i => i.addr === addr);
		if (!source) {
			source = {
				addr,
				rssi,
				name: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_NAME_SHORTENED,
					BT_DataType.BT_DATA_NAME_COMPLETE
				])?.value,
				broadcast_name: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_BROADCAST_NAME
				])?.value
			}

			this.#sources.push(source)
			this.dispatchEvent(new CustomEvent('source-found', {detail: { source }}));
		} else {
			console.log(`source rssi updated ${source.rssi} -> ${rssi}`)
			source.rssi = rssi;
			this.dispatchEvent(new CustomEvent('source-updated', {detail: { source }}));
		}
	}

	handleSinkFound(message) {
		console.log(`Handle found Sink`);

		const payloadArray = ltvToTvArray(message.payload);
		// console.log('Payload', payloadArray);

		const addr = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_PUB_TARGET_ADDR,
			BT_DataType.BT_DATA_RAND_TARGET_ADDR
		]);

		if (!addr) {
			// TBD: Throw exception?
			return;
		}

		const rssi = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_RSSI
		])?.value;

		// If device already exists, just update RSSI, otherwise add to list
		let sink = this.#sinks.find(i => i.addr.value === addr.value);
		if (!sink) {
			sink = {
				addr,
				rssi,
				name: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_NAME_SHORTENED,
					BT_DataType.BT_DATA_NAME_COMPLETE
				])?.value,
				uuid16s: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_UUID16_ALL,
					BT_DataType.BT_DATA_UUID16_SOME,
				])?.value || []
			}

			this.#sinks.push(sink)
			this.dispatchEvent(new CustomEvent('sink-found', {detail: { sink }}));
		} else {
			sink.rssi = rssi;
			this.dispatchEvent(new CustomEvent('sink-updated', {detail: { sink }}));
		}
	}

	handleRES(msg) {
		console.log(`Response message 0x${msg.type.toString(16)}`);
	}

	handleEVT(message) {
		console.log(`Event with subType 0x${message.subType.toString(16)}`);

		switch (message.subType) {
			case MessageSubType.SINK_FOUND:
			this.handleSinkFound(message);
			break;
			case MessageSubType.SOURCE_FOUND:
			this.handleSourceFound(message);
			break;
			default:
			console.log(`Missing handler for subType 0x${message.subType.toString(16)}`);
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

		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.STOP_SCAN,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.#service.sendCMD(message)
	}

	connectToSink(sink) {
		console.log("Sending Connect Sink CMD");

		const { addr } = sink;

		if (!addr) {
			throw Error("Address not found in sink object!");
		}

		const payload = tvArrayToLtv([addr]);

		console.log('addr payload', payload);

		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.CONNECT_SINK,
			seqNo: 123,
			payload
		};

		this.#service.sendCMD(message);
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
