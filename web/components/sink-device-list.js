// @ts-check

import * as AssistantModel from '../models/assistant-model.js';

import { SinkItem } from './sink-item.js';
import './app-button.js';

/*
* Sink Device List Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */

#scan {
	border-radius: 20px;
}

#container {
	display: flex;
	flex-direction: column;
}
#list {
	display: flex;
	flex-direction: column;
}
</style>
<div id="container">
<app-button id="scan">SCAN SINK</app-button>
<div id="list">
</div>
</div>
`;

export class SinkDeviceList extends HTMLElement {
	#list
	#scanButton
	#model

	constructor() {
		super();

		this.sinkFound = this.sinkFound.bind(this);
		this.sinkUpdated = this.sinkUpdated.bind(this);
		this.sinkClicked = this.sinkClicked.bind(this);

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		console.log("connectedCallback - SinkDeviceList");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));
		// Add listeners, etc.
		this.#scanButton = this.shadowRoot?.querySelector('#scan');
		this.#list = this.shadowRoot?.querySelector('#list');

		this.sendStartSinkScan = this.sendStartSinkScan.bind(this);

		this.#scanButton.addEventListener('click', this.sendStartSinkScan);

		this.#model = AssistantModel.getInstance();

		this.#model.addEventListener('sink-found', this.sinkFound)
		this.#model.addEventListener('sink-updated', this.sinkUpdated)
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

	sendStartSinkScan() {
		console.log("Clicked Start Sink Scan")

		this.#model.startSinkScan();
	}

	sinkClicked(evt) {
		const sinkEl = evt.target;
		// When sink is not connected, request for the sink to be connected
		// and mark the sink with connection pending.
		// Successful connection will result in an event from the attached
		// broadcast assistant device.

		// Likewise, if the sink is connected, a disconnect request is sent,
		// item is marked disconnection pending, etc.

		const sink = sinkEl.getModel();

		console.log('Sink clicked:', sink);

		// For now - just call connect (until we have more state handling)
		this.#model.connectToSink(sink);
	}

	sinkFound(evt) {
		// Assume that the AssistantModel has eliminated duplicates
		// If the addr is random and RPA changed, device will appear
		// As duplicate and the old entry will stay (stale)
		// TODO: Possibly remove stale entries - however, this should
		// not be a big issue.
		const { sink } = evt.detail;

		const el = new SinkItem();
		this.#list.appendChild(el);
		el.setModel(sink);

		el.addEventListener('click', this.sinkClicked);
	}

	sinkUpdated(evt) {
		const { sink } = evt.detail;

		const items = Array.from(this.#list.querySelectorAll('sink-item'));

		const el = items.find(i => i.getModel() === sink);

		if (el) {
			el.refresh();
		} else {
			console.warn('sink not found!', sink);
		}
	}
}
customElements.define('sink-device-list', SinkDeviceList);
