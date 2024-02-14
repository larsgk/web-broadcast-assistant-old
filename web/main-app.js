// @ts-check

import './components/sink-device-list.js';
import './components/source-device-list.js';
import './components/app-button.js';

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


</style>

<div class="flex-container">
	<div class="content">
		<div class="col">
			<h2>WebUSB Broadcast Assistant</h2>
			<div class="row">
				<app-button id='connect'>Connect to WebUSB device</app-button>
			</div>

			<!-- broadcast sink components... -->
			<sink-device-list></sink-device-list>

			<!-- broadcast source components... -->
			<source-device-list></source-device-list>
		</div>
	</div>
</div>
`;

export class MainApp extends HTMLElement {

	constructor() {
		super();

		this.initializeModels();

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	initializeModels() {
		console.log("Initialize Models...");

		AssistantModel.initializeAssistantModel(WebUSBDeviceService);
	}

	connectedCallback() {
		console.log("connectedCallback - MainApp");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));

		// Temporatily hook up the connect button here...
		const button = this.shadowRoot?.querySelector('#connect');

		button?.addEventListener('click', WebUSBDeviceService.scan);
	}

}
customElements.define('main-app', MainApp);
