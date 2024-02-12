// @ts-check

import { MessageType, MessageSubType } from '../lib/message.js';

/**
* Assistant Model
*
* Keeps state info on sources & sinks
* Handles commands, responses and events
*
*/

export class AssistantModel extends EventTarget {
	#service

	sources = [];
	sinks = [];

	isScanning = false;
	serviceIsConnected = false;

	constructor(service) {
		super();

		this.#service = service;

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

	handleStartSinkScan() {
		console.log(`Tell component to start sink scanning`);
	}

	handleStartSourceScan() {
		console.log(`Tell component to start source scanning`);
	}

	parseDevice(adData) {
		console.log(`Data to parse: ${adData}`);
	}

	handleSourceFound(data) {
		console.log(`Handle found Source`);
		console.log(`Payload:${data}`);
	}

	handleSinkFound(data) {
		console.log(`Handle found Sink`);
		console.log(`Payload:${data}`);
	}

	handleCMD(cmd) {
		console.log(`Command with subType ${cmd.subType}`);

		switch (cmd.subType) {
			case MessageSubType.START_SINK_SCAN:
			this.handleStartSinkScan();
			break;
			case MessageSubType.START_SOURCE_SCAN:
			this.handleStartSourceScan();
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
		console.log(`Received event ${msg} in componentMessageHandler`);

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

	componentMessageHandler(msg) {
		console.log(`Received event ${msg} in componentMessageHandler`);

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
