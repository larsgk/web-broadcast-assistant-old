// @ts-check

import './components/sink-device-list.js';

import * as AssistantModel from './models/assistant-model.js';
import { WebUSBDeviceService } from './services/webusb-device-service.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
</style>

<h1>WebUSB Broadcast Assistant...</h1>
<button id='connect'>CONNECT</button>
<br><br>

<!-- broadcast sink components... -->
<sink-device-list></sink-device-list>
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
