import { buildQuestionPrompt } from "$lib/buildPrompt";
import { PUBLIC_SEP_TOKEN } from "$lib/constants/publicSepToken";
import { trimPrefix } from "$lib/utils/trimPrefix";
import { trimSuffix } from "$lib/utils/trimSuffix";
import { generateFromEndpoint } from "../generateFromEndpoint";
import { models_summarize } from "../models";

export async function summarizeWeb(content: string, query: string, model: BackendModel) {
	// const summaryPrompt =
	// 	model.userMessageToken +
	// 	content
	// 		.split(" ")
	// 		.slice(0, model.parameters?.truncate ?? 0)
	// 		.join(" ") +
	// 	model.messageEndToken +
	// 	model.userMessageToken +
	// 	`The text above should be summarized to best answer the query: ${query}.` +
	// 	model.messageEndToken +
	// 	model.assistantMessageToken +
	// 	"Summary: ";

	const question = `The text above should be summarized to best answer the question: ${query}`

	const summarizeModel = models_summarize.find((m) => m.id === model.id);

	const words = content.split(" ");
	const chunkSize = 1000;
	const chunks = [];
	let counter = 0;
	for (let i = 0; i < words.length; i += chunkSize) {
		const chunk = words.slice(i, i + chunkSize).join(" ");
		//console.log("PROMPT: " + chunk)
		const summaryPrompt = await buildQuestionPrompt(chunk, question, summarizeModel);
		
		const summary = await generateFromEndpoint(summarizeModel, summaryPrompt).then((txt: string) =>
			txt.trim().replace(question, "")
		);
		// replace question string from summary with empty string

		chunks.push(summary);

		counter++;
		if (counter >=2) {
			break;
		}
	}

	const summary = chunks.join("\n\n");

	return summary;
}
