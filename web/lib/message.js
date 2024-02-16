// @ts-check

import { cobsEncode, cobsDecode } from './cobs.js';
import { arrayToHex } from './helpers.js';

/**
* This module contains enums and functions related to messages
*
* message format:
*
*              type,           // 1byte, CMD, RES or EVT
*              subType,        // 1byte, e.g. START_SINK_SCAN (CMD/RES) or SINK_FOUND (EVT)
*              seqNo,          // 1byte, (to match CMD & RES, detect missing EVT)
*              payloadSize,    // 2byte, byte length of payload
*              payload         // Nbytes (payload for further processing, Uint8Array)
*
*/

export const MessageType = Object.freeze({
	CMD: 1,
	RES: 2,
	EVT: 3
});

export const MessageSubType = Object.freeze({
	// CMD/RES (MSB = 0)
	START_SINK_SCAN:	0x01,
	START_SOURCE_SCAN:	0x02,
	STOP_SCAN:		0x03,

	DUMMY:			0x7F,

	// EVT (MSB = 1)
	SINK_FOUND:		0x81,
	SOURCE_FOUND:		0x82,

	HEARTBEAT:		0xFF,
});

export const BT_DataType = Object.freeze({
	BT_DATA_UUID16_SOME:		0x02,
	BT_DATA_UUID16_ALL:		0x03,
	BT_DATA_UUID32_SOME:		0x04,
	BT_DATA_UUID32_ALL:		0x05,

	BT_DATA_NAME_SHORTENED:		0x08,
	BT_DATA_NAME_COMPLETE:		0x09,

	BT_DATA_SVC_DATA16:		0x16,

	BT_DATA_PUB_TARGET_ADDR:	0x17,
	BT_DATA_RAND_TARGET_ADDR:	0x18,

	BT_DATA_BROADCAST_NAME:		0x30,

	BT_DATA_RSSI:			0xfe,
});

export const BT_UUID = Object.freeze({
	BT_UUID_BROADCAST_AUDIO:	0x1852,
});

export const msgToArray = msg => {
	// Simple validation
	if (!Object.values(MessageType).includes(msg?.type)) {
		throw new Error(`Message type invalid (${msg?.type})`);
	}

	if (!Object.values(MessageSubType).includes(msg?.subType)) {
		throw new Error(`Message subType invalid (${msg?.subType})`);
	}
	// TBD: Maybe check subType MSB against message type

	// If seqNr is anything but an integer between 0 and 255, default to 0.
	// Note: This also means that it can be omitted and default to 0.
	let seqNo = msg?.seqNo;
	if (!Number.isInteger(seqNo) || seqNo < 0 || seqNo > 255) {
		seqNo = 0;
	}

	// If payloadSize is omitted, it will be set to the length of the payload
	// The payload can be 'undefined' or an Uint8Array, if undefined, length = 0
	let payloadSize = msg?.payloadSize;
	if (payloadSize !== undefined && msg.payload === undefined) {
		throw new Error(`payloadSize must be omitted if payload is omitted`);
	}

	if (msg.payload instanceof Uint8Array) {
		const actSize = msg.payload.length;
		if (payloadSize === undefined) {
			payloadSize = actSize;
		} else if (Number.isInteger(payloadSize)) {
			if (payloadSize !== actSize) {
				throw new Error(`Actual payload size (${actSize})` +
				` != payloadSize (${msg.payloadSize})`);
			}
		} else {
			throw new Error(`Invalid payloadSize (${payloadSize})`);
		}
	} else if (msg.payload === undefined) {
		payloadSize = 0;
	} else {
		throw new Error("If set, payload must be a Uint8Array");
	}

	console.log('Validation complete...');

	const header = new Uint8Array([msg.type, msg.subType, seqNo, payloadSize & 0xff, payloadSize >> 8]);

	if (msg.payload instanceof Uint8Array && msg.payload.length !== 0) {
		const msgWithPayload = new Uint8Array(header.length + msg.payload.length);
		msgWithPayload.set(header);
		msgWithPayload.set(msg.payload, header.length);

		return msgWithPayload;
	}

	return header;
}

export const arrayToMsg = data => {
	if (!(data instanceof Uint8Array)) {
		throw new Error("Input data must be a Uint8Array");
	}

	if (data.length < 5) {
		throw new Error(`Array too short (${data.length} < 5)`);
	}

	const payloadSize = data[3] + (data[4] << 8);
	if (data.length !== payloadSize + 5) {
		throw new Error(`Actual payload size (${data.length - 5}) != payloadSize (${payloadSize})`);
	}

	// TODO: Full validation
	console.log('Validation complete...');

	return {
		type: data[0],
		subType: data[1],
		seqNo: data[2],
		payloadSize,
		payload: data.slice(5)
	}
}

const utf8decoder = new TextDecoder();

const bufToAddressString = (data) => {
	if (data.length != 6) {
		return `UNKNOWN ADDRESS`
	}

	return Array.from(data, byte => {
		return ('0' + (byte & 0xFF).toString(16)).slice(-2);
	}).join(':')
}

const bufToInt8Array = (data) => {
	const res = [];

	for (var i = 0; i < data.length; i++) {
		var intSign = data[i] & (1 << 7);
		res[i] = (data[i] & 0x7f) * (intSign !== 0 ? -1 : 1);
	}

	return res;
}

const bufToValueArray = (data, itemsize) => {
	// Used to extract uint8, 16, 24 or 32 values
	if (!(data instanceof Uint8Array)) {
		throw new Error("Input data must be a Uint8Array");
	}

	if (itemsize < 1 || itemsize > 4) {
		return [];
	}

	if (data.length % itemsize !== 0) {
		return [];
	}

	const res = [];
	let ptr = 0;
	while (ptr < data.length) {
		let item = 0;
		let count = 0;
		while(count < itemsize) {
			item += data[ptr++] << (8*count);
			count++;
		}
		res.push(item);
	}

	return res;
}

const parseLTVItem = (type, len, value) => {
	// type: uint8 (AD type)
	// len: utin8
	// value: Uint8Array

	if (len === 0 || len != value.length) {
		return;
	}

	const item = { type };
	// For now, just parse the ones we know
	switch (type) {
		case BT_DataType.BT_DATA_NAME_SHORTENED:
		case BT_DataType.BT_DATA_NAME_COMPLETE:
		case BT_DataType.BT_DATA_BROADCAST_NAME:
		item.value = utf8decoder.decode(value);
		break;
		case BT_DataType.BT_DATA_UUID16_SOME:
		case BT_DataType.BT_DATA_UUID16_ALL:
		item.value = bufToValueArray(value, 2);
		break;
		case BT_DataType.BT_DATA_UUID32_SOME:
		case BT_DataType.BT_DATA_UUID32_ALL:
		item.value = bufToValueArray(value, 4);
		break;
		case BT_DataType.BT_DATA_PUB_TARGET_ADDR:
		item.value = bufToAddressString(value)
		break;
		case BT_DataType.BT_DATA_RAND_TARGET_ADDR:
		item.value = `${bufToAddressString(value)} (random)`
		break;
		case BT_DataType.BT_DATA_RSSI:
		item.value = bufToInt8Array(value);
		break;
		default:
		item.value = "UNHANDLED";
		break;
	}

	return item;
}

export const ltvToArray = payload => {
	const res = [];

	console.log('LTV decode of: ', arrayToHex(payload));
	let ptr = 0;
	// Iterate over the LTV fields and convert to items in array.
	while (ptr < payload.length) {
		const len = payload[ptr++] - 1;
		const type = payload[ptr++];
		if (ptr + len > payload.length) {
			console.warn("Error in LTV structure");
			break;
		}
		const value = payload.subarray(ptr, ptr + len);
		ptr += len;

		const item = parseLTVItem(type, len, value);
		if (item) {
			res.push(item);
		}
	}

	return res;
}

export const ltvArrayFindValue = (arr, types) => {
	// This will find and return the first value, matching any type given

	return arr.find(item => types.includes(item.type));
}
