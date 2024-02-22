// @ts-check

import * as AssistantModel from '../models/assistant-model.js';

/*
* Heartbeat Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
	.heartbeat_button {
		background-color: #ffffff;
		box-shadow: 0 0 3px #000000;
		border-radius: 10px;
		border: none;
		font-family: sans-serif;
		font-size: 20px;
		text-align: center;
		text-decoration: none;
		padding: 3px 5px;
	}

	.heartbeat_img {
		content:url("./web/images/heart_inactive.svg");
	}

	.heartbeat_img.animation {
		animation: heart_beat 500ms 1;
	}

	@keyframes heart_beat {
		0% {
			content:url("./web/images/heart_active.svg");
		}
		100% {
			content:url("./web/images/heart_inactive.svg");
		}
	}
	</style>

	<button id="heartBtn" class="heartbeat_button">Heartbeat</button>
	<img id="heartImg" class="heartbeat_img">

	`;

export class HeartBeat extends HTMLElement {
	#heartbeatButton
	#heartbeatImage
	#model

	constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		console.log("connectedCallback - HeartBeat");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));

		// Add listeners, etc.
		this.heartbeatButton = this.shadowRoot?.querySelector('#heartBtn');
		this.heartbeatImage = this.shadowRoot?.querySelector('#heartImg');

		this.#model = AssistantModel.getInstance();

		this.heartbeatButton.addEventListener('click', (event) => {
			//console.log("Clicked Heartbeat")
			this.#model.startHeartbeat();
		});

		this.#model.addEventListener('heartbeat-received', (event) => {
			const heartbeat_count = event.detail;
			//console.log("Heartbeat: " + heartbeat_count);
			// Heartbeat tick received, begin animation
			this.heartbeatImage.classList.add('animation')
		});

		this.heartbeatImage.addEventListener("animationend", (event) => {
			// Heartbeat animation ended, remove the animator until next tick
			this.heartbeatImage.classList.remove('animation')
		});
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

}
customElements.define('heartbeat-indicator', HeartBeat);
