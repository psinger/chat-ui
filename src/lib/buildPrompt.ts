import type { BackendModel } from "./server/models";
import type { Message } from "./types/Message";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";
/**
 * Convert [{user: "assistant", content: "hi"}, {user: "user", content: "hello"}] to:
 *
 * <|assistant|>hi<|endoftext|><|prompter|>hello<|endoftext|><|assistant|>
 */

export async function buildPrompt(
	messages: Pick<Message, "from" | "content">[],
	model: BackendModel,
	webSearchId?: string
): Promise<string> {
	

	if (webSearchId) {
		const webSearch = await collections.webSearches.findOne({
			_id: new ObjectId(webSearchId),
		});

		if (!webSearch) throw new Error("Web search not found");

		const prompt =
		messages
			.map(
				(m) =>
					(m.from === "user"
						?  m.content
						: m.content) +
					(model.messageEndToken
						? m.content.endsWith(model.messageEndToken)
							? ""
							: model.messageEndToken
						: "")
			)
			.join("") + model.assistantMessageToken;

		// if (webSearch.summary) {
		// 	webPrompt =
		// 		//model.assistantMessageToken +
		// 		//`The following context was found while searching the internet: ${webSearch.summary}` +
		// 		model.userMessageToken +
		// 		`${webSearch.summary}` +
		// 		model.messageEndToken +
		// 		model.assistantMessageToken;
		// }

		const finalPrompt =
			model.preprompt +
			model.assistantMessageToken +
			`${webSearch.summary}` +
			model.messageEndToken +
			model.userMessageToken +
			prompt
				.split(" ")
				.slice(-(model.parameters?.truncate ?? 0))
				.join(" ");

		console.log("search prompt: " + finalPrompt);

		// Not super precise, but it's truncated in the model's backend anyway
		return finalPrompt;
	} else
	{

		const prompt =
		messages
			.map(
				(m) =>
					(m.from === "user"
						? model.userMessageToken + m.content
						: model.assistantMessageToken + m.content) +
					(model.messageEndToken
						? m.content.endsWith(model.messageEndToken)
							? ""
							: model.messageEndToken
						: "")
			)
			.join("") + model.assistantMessageToken;
		const finalPrompt =
			model.preprompt +
			prompt
				.split(" ")
				.slice(-(model.parameters?.truncate ?? 0))
				.join(" ");

		console.log("final prompt: " + finalPrompt);

		// Not super precise, but it's truncated in the model's backend anyway
		return finalPrompt;
	}

	
}

export async function buildQuestionPrompt(
	content: string,
	question: string,
	model: BackendModel,
): Promise<string> {
	

	const finalPrompt =
		model.preprompt +
		model.assistantMessageToken +
		content
			.split(" ")
			.slice(0, (model.parameters?.truncate-64 ?? 0))
			.join(" ") +
		model.messageEndToken +
		model.userMessageToken +
		question +
		model.messageEndToken +
		model.assistantMessageToken

	// Not super precise, but it's truncated in the model's backend anyway
	return finalPrompt;


	
}
