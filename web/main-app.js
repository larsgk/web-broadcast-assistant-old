// @ts-check

import './components/sink-device-list.js';
import './components/source-device-list.js';

import * as AssistantModel from './models/assistant-model.js';
import { WebUSBDeviceService } from './services/webusb-device-service.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
.flex-container {
	display: flex;
	height: 100%;
}

.content {
	margin: auto;
	position: relative;
	width: 95%;
	max-width: 700px;
}

.col {
	display: flex;
	flex-direction: column;
}

.row {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
}

button {
	display: block;
	position: relative;
	box-sizing: border-box;
	min-width: 5.14em;
        width: 100%;
	margin: 0.2em;
	background: transparent;
	text-align: center;
	font: inherit;
	text-transform: uppercase;
	outline: none;
	border-radius: 5px;
	user-select: none;
	cursor: pointer;
	z-index: 0;
	padding: 0.7em 0.57em;
	box-shadow: 0 2px 2px 0 rgba(0,0,0,0.14), 0 1px 5px 0 rgba(0,0,0,0.12), 0 3px 1px -2px rgba(0,0,0,0.2);
	background-color: var(--background-color, darkgray);
	color: white;
      }

button:hover {
	box-shadow: 0 3px 3px 0 rgba(0,0,0,0.14), 0 1px 7px 0 rgba(0,0,0,0.12), 0 3px 1px -1px rgba(0,0,0,0.2);
	background-color: var(--background-color-hover, gray);
}

button:disabled {
	background-color: red;
}

</style>

<div class="flex-container">
	<div class="content">
		<div class="col">
			<h2>WebUSB Broadcast Assistant</h2>
			<button id='connect'>Connect to WebUSB device</button>

			<!-- broadcast sink components... -->
			<button id="sink_scan">Scan for sinks</button>
			<sink-device-list></sink-device-list>

			<!-- broadcast source components... -->
			<button id="source_scan">Scan for sources</button>
			<source-device-list></source-device-list>
		</div>
	</div>
</div>
`;

export class MainApp extends HTMLElement {
	#scanSinkButton
	#scanSourceButton
	#model

	constructor() {
		super();

		this.initializeModels();

		const shadowRoot = this.attachShadow({mode: 'open'});

		this.sendStartSinkScan = this.sendStartSinkScan.bind(this);
		this.sendStartSourceScan = this.sendStartSourceScan.bind(this);
	}

	initializeModels() {
		console.log("Initialize Models...");

		this.#model = AssistantModel.initializeAssistantModel(WebUSBDeviceService);
	}

	connectedCallback() {
		console.log("connectedCallback - MainApp");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));

		// Temporatily hook up the connect button here...
		const button = this.shadowRoot?.querySelector('#connect');

		button?.addEventListener('click', WebUSBDeviceService.scan);

		this.#scanSinkButton = this.shadowRoot?.querySelector('#sink_scan');
		this.#scanSinkButton.addEventListener('click', this.sendStartSinkScan)

		this.#scanSourceButton = this.shadowRoot?.querySelector('#source_scan');
		this.#scanSourceButton.addEventListener('click', this.sendStartSourceScan)
	}

	sendStartSinkScan() {
		console.log("Clicked Start Sink Scan")

		this.#model.startSinkScan();

		// TODO: Disable when we have functionality to renable (when scanning has stopped)
		// this.#scanSinkButton.disabled = true;
	}

	sendStartSourceScan() {
		console.log("Clicked Start Source Scan")

		this.#model.startSourceScan();

		// TODO: Disable when we have functionality to renable (when scanning has stopped)
		// this.#scanSourceButton.disabled = true;
	}
}
customElements.define('main-app', MainApp);
