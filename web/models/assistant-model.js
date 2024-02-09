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
	service
	component

	sources = [];
	sinks = [];

	isScanning = false;
	serviceIsConnected = false;

	constructor(service, component) {
		super();

		this.service = service;
		this.component = component;

		this.serviceMessageHandler = this.serviceMessageHandler.bind(this);
		this.componentMessageHandler = this.componentMessageHandler.bind(this);

		this.initialize();
	}


	initialize() {
		this.service.addEventListener('connected', evt => {
			console.log('AssistantModel registered Service as connected');
			this.serviceIsConnected = true;
		});
		this.service.addEventListener('disconnected', evt => {
			console.log('AssistantModel registered Service as disconnected');
			this.serviceIsConnected = false;
		});
		this.service.addEventListener('message', this.serviceMessageHandler);
		this.component.addEventListener('message', this.componentMessageHandler);
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
}
