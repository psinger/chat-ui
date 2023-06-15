import { modelEndpoint } from "./modelEndpoint";
import { textGeneration } from "@huggingface/inference";
import { trimSuffix } from "$lib/utils/trimSuffix";
import { trimPrefix } from "$lib/utils/trimPrefix";
import { PUBLIC_SEP_TOKEN } from "$lib/constants/publicSepToken";
import { z } from "zod";
import { construct_svelte_component } from "svelte/internal";

interface Parameters {
	temperature: number;
	truncate: number;
	max_new_tokens: number;
	stop: string[];
}
export async function generateFromEndpoint(
	model: BackendModel,
	prompt: string,
	parameters?: Partial<Parameters>,
) {
	const newParameters = {
		...model.parameters,
		...parameters,
		return_full_text: false,
	};

	const endpoint = modelEndpoint(model);

	const url = endpoint.url;
	const data = {
		inputs: prompt,
		parameters: newParameters
	};

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: endpoint.authorization,
			},
			body: JSON.stringify(data),
		});
		const resp = await response.json()
		const generated_text = trimSuffix(trimPrefix(resp.generated_text, "<|startoftext|>"), PUBLIC_SEP_TOKEN);

		return generated_text

	} catch (error) {
		console.error(error);
		return ""
	}

	

	/*
	let { generated_text } = await textGeneration(
		{
			model: "http://127.0.0.1:6112/generate",
			inputs: prompt,
			parameters: newParameters,
		},
		{
			fetch: (url, options) =>
				fetch(url, {
					...options,
					headers: { ...options?.headers, Authorization: endpoint.authorization },
				}),
		}
	);
	*/
	
}
