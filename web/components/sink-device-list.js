// @ts-check

import * as AssistantModel from '../models/assistant-model.js';

/**
* Dummy Component
*
* This is just a template for components
*
* [EARLY DRAFT]
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */
#container {
	display: flex;
	flex-direction: column;
	width: 95%;
	max-width: 700px;
	background: green;
}
#list {
	display: flex;
	flex-direction: column;
}
</style>
<div id="container">
<button id="scansrcbtn">SCAN SOURCE</button>
<div id="list">
</div>
</div>
`;

export class SinkDeviceList extends HTMLElement {
	#list
	#scanButton

	constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		console.log("connectedCallback - SinkDeviceList");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));
		// Add listeners, etc.
		this.#scanButton = this.shadowRoot?.querySelector('#scansrcbtn');
		this.#list = this.shadowRoot?.querySelector('#list');

		this.sendStartSinkScan = this.sendStartSinkScan.bind(this);

		this.#scanButton.addEventListener('click', this.sendStartSinkScan)
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

	sendStartSinkScan() {
		console.log("Clicked Start Sink Scan")

		let model = AssistantModel.getInstance();
		model.startSinkScan();

		// Add fake device element
		const el = document.createElement('span');
		el.innerHTML = "Nice device...";
		this.#list.appendChild(el);
	}
}
customElements.define('sink-device-list', SinkDeviceList);
