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
*
* 	bt_name: string | undefined,
* 	broadcast_name: string | undefined
* 	broadcast_id: uint24, (UNIQUE IDENTIFIER)
* 	rssi: int8
*
*
* Sink device structure
*
*
* 	bt_addr: string | undefined, (UNIQUE IDENTIFIER)
* 	bt_name: string | undefined,
* 	connection_state: boolean,
* 	security_level: uint8,
* 	bass_state: idle | configured | streaming,
* 	broadcast_id: uint24,
* 	rssi: int8
*
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

	handleHeartbeat(message) {
		console.log(`Handle Heartbeat`);
		const payloadArray = ltvToTvArray(message.payload);
		console.log('Payload', payloadArray);

		const heartbeat_cnt = message.seqNo;

		this.dispatchEvent(new CustomEvent('heartbeat-received', {detail: heartbeat_cnt}));
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
		let source = this.#sources.find(i => i.addr.value === addr.value);
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
				])?.value,
				broadcast_id: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_BROADCAST_ID
				])?.value,
				pa_interval: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_PA_INTERVAL
				])?.value,
				sid: tvArrayFindItem(payloadArray, [
					BT_DataType.BT_DATA_SID
				])?.value
			}

			this.#sources.push(source)
			this.dispatchEvent(new CustomEvent('source-found', {detail: { source }}));
		} else {
			source.rssi = rssi;
			this.dispatchEvent(new CustomEvent('source-updated', {detail: { source }}));
		}
	}

	handleSourceAdded(message) {
		console.log(`Handle Source added`);

		const payloadArray = ltvToTvArray(message.payload);

		const sink_addr = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_PUB_TARGET_ADDR,
			BT_DataType.BT_DATA_RAND_TARGET_ADDR
		]);

		if (!sink_addr) {
			// TBD: Throw exception?
			return;
		}

		const err = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_ERROR_CODE
		])?.value;

		const broadcast_id = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_BROADCAST_ID
		])?.value

		// If device already exists, just update RSSI, otherwise add to list
		let sink = this.#sinks.find(i => i.addr.value === sink_addr.value);
		if (!sink) {
			console.warn("Source added to unknown sink addr:", sink_addr);
			return;
		}

		let source = this.#sources.find(i => i.broadcast_id === broadcast_id);
		if (!source) {
			console.warn("Unknown source with broadcast ID:", broadcast_id?.toString(16).padStart(6, '0'));
			return;
		}

		this.#sources.forEach( s => {
			s.state = source === s ? "selected" : undefined;
			this.dispatchEvent(new CustomEvent('source-updated', {detail: { source: s }}));
		});

		sink.source_added = source;
		this.dispatchEvent(new CustomEvent('sink-updated', {detail: { sink }}));
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

	handleSinkConnectivityEvt(message) {
		console.log(`Handle connected/disconnected Sink`);

		const payloadArray = ltvToTvArray(message.payload);

		const addr = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_PUB_TARGET_ADDR,
			BT_DataType.BT_DATA_RAND_TARGET_ADDR
		]);

		if (!addr) {
			// TBD: Throw exception?
			return;
		}

		const err = tvArrayFindItem(payloadArray, [
			BT_DataType.BT_DATA_ERROR_CODE
		])?.value;

		// If device already exists, just update RSSI, otherwise add to list
		let sink = this.#sinks.find(i => i.addr.value === addr.value);
		if (!sink) {
			console.warn("Unknown sink connected with addr:", addr);
		} else {
			if (err !== 0) {
				console.log("Error code", err);
				sink.state = "failed";
			} else {
				if (message.subType === MessageSubType.SINK_CONNECTED) {
					sink.state = "connected";
					this.dispatchEvent(new CustomEvent('sink-updated', {detail: { sink }}));
				} else {
					sink.state = "";
					this.dispatchEvent(new CustomEvent('sink-disconnected', {detail: { sink }}));
				}
			}
		}
	}

	handleRES(message) {
		console.log(`Response message with subType 0x${message.subType.toString(16)}`);

		switch (message.subType) {
			case MessageSubType.START_SINK_SCAN:
			console.log('START_SINK_SCAN response received');
			this.dispatchEvent(new CustomEvent('sink-scan-started'));
			break;
			case MessageSubType.START_SOURCE_SCAN:
			console.log('START_SOURCE_SCAN response received');
			this.dispatchEvent(new CustomEvent('source-scan-started'));
			break;
			case MessageSubType.STOP_SCAN:
			console.log('STOP_SCAN response received');
			this.dispatchEvent(new CustomEvent('scan-stopped'));
			break;
			case MessageSubType.CONNECT_SINK:
			console.log('CONNECT_SINK response received');
			break;
			case MessageSubType.ADD_SOURCE:
			console.log('ADD_SOURCE response received');
			// NOOP/TODO
			break;
			case MessageSubType.RESET:
			console.log('RESET response received');
			this.dispatchEvent(new CustomEvent('scan-stopped'));
			break;
			default:
			console.log(`Missing handler for RES subType 0x${message.subType.toString(16)}`);
		}

	}

	handleEVT(message) {
		console.log(`Event with subType 0x${message.subType.toString(16)}`);

		switch (message.subType) {
			case MessageSubType.HEARTBEAT:
			this.handleHeartbeat(message);
			break;
			case MessageSubType.SINK_FOUND:
			this.handleSinkFound(message);
			break;
			case MessageSubType.SINK_CONNECTED:
			case MessageSubType.SINK_DISCONNECTED:
			this.handleSinkConnectivityEvt(message);
			break;
			case MessageSubType.SOURCE_FOUND:
			this.handleSourceFound(message);
			break;
			case MessageSubType.SOURCE_ADDED:
			this.handleSourceAdded(message);
			break;
			case MessageSubType.STOP_SCAN:
			console.log('STOP_SCAN response received');
			this.dispatchEvent(new CustomEvent('scan-stopped'));
			break;
			default:
			console.log(`Missing handler for EVT subType 0x${message.subType.toString(16)}`);
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

	resetBA() {
		console.log("Sending Reset CMD")

		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.RESET,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.#service.sendCMD(message)

		// Also reset the UI
		this.dispatchEvent(new Event('reset'));
		this.#sinks = [];
		this.#sources = [];
	}

	startHeartbeat() {
		console.log("Sending Heartbeat CMD")

		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.HEARTBEAT,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.#service.sendCMD(message)
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

	addSource(source) {
		console.log("Sending Add Source CMD");

		const { addr } = source;

		if (!addr) {
			throw Error("Address not found in source object!");
		}

		const sidItem = { type: BT_DataType.BT_DATA_SID, value: source.sid };
		console.log(sidItem);

		const intervalItem = { type: BT_DataType.BT_DATA_PA_INTERVAL, value: source.pa_interval };
		console.log(intervalItem);

		const bidItem = { type: BT_DataType.BT_DATA_BROADCAST_ID, value: source.broadcast_id };
		console.log(bidItem);

		const tvArr = [
			{ type: BT_DataType.BT_DATA_SID, value: source.sid },
			{ type: BT_DataType.BT_DATA_PA_INTERVAL, value: source.pa_interval },
			{ type: BT_DataType.BT_DATA_BROADCAST_ID, value: source.broadcast_id },
			addr,
		];

		const payload = tvArrayToLtv(tvArr);

		console.log('Add Source payload', payload)

		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.ADD_SOURCE,
			seqNo: 123,
			payload
		};

		this.#service.sendCMD(message);
	}

	connectSink(sink) {
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

		sink.state = "connecting";
		this.dispatchEvent(new CustomEvent('sink-updated', {detail: { sink }}));
	}

	disconnectSink(sink) {
		console.log("Sending Disconnect Sink CMD");

		const { addr } = sink;

		if (!addr) {
			throw Error("Address not found in sink object!");
		}

		const payload = tvArrayToLtv([addr]);

		console.log('addr payload', payload);

		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.DISCONNECT_SINK,
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
	return _instance;
}

export const getInstance = () => {
	if (!_instance) {
		throw Error("AssistantModel not instantiated...");
	}
	return _instance;
}
