// @ts-check

import * as AssistantModel from '../models/assistant-model.js';

import './sink-item.js';
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

		this.addFoundSink = this.addFoundSink.bind(this);

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

		this.#model.addEventListener('sink-found', this.addFoundSink)
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

	sendStartSinkScan() {
		console.log("Clicked Start Sink Scan")

		this.#model.startSinkScan();
	}

	addFoundSink(evt) {
		const { sink } = evt.detail;

		console.log('EVT', evt);

		// Just use the name for now... ignore duplicates...
		var elements = this.#list.querySelectorAll('sink-item');
		var sinkExists = false;
		elements.forEach( e => {
			var sinkName = e.shadowRoot.getElementById('name')?.textContent
			if (sinkName === sink.name) {
				sinkExists = true;
				return;
			}
		});

		// TODO: Update RSSI before returning
		if (sinkExists) {
			return;
		}

		// Just use the name for now... ignore duplicates...
		const el = document.createElement('sink-item');
		this.#list.appendChild(el);
		el.setModel(sink);
	}
}
customElements.define('sink-device-list', SinkDeviceList);
