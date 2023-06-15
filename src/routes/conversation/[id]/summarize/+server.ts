import { buildQuestionPrompt } from "$lib/buildPrompt";
import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { generateFromEndpoint } from "$lib/server/generateFromEndpoint";
import { models_summarize } from "$lib/server/models";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";

export async function POST({request, fetch, params, locals }) {
	const convId = new ObjectId(params.id);

	const conversation = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conversation) {
		throw error(404, "Conversation not found");
	}

	const summarizeModel = models_summarize.find((m) => m.id === conversation.model);

	const firstMessage = conversation.messages.find((m) => m.from === "user");

	const content = firstMessage?.content;
	const question = "Output a short and cohesive title in two words summarizing the previous message. Only print the title."

	const prompt = await buildQuestionPrompt(content, question, summarizeModel);

	const generated_text = await generateFromEndpoint(summarizeModel, prompt);

	if (generated_text) {
		await collections.conversations.updateOne(
			{
				_id: convId,
				...authCondition(locals),
			},
			{
				$set: { title: generated_text.replace(/"/g, "")},
			}
		);
	}

	return new Response(
		JSON.stringify(
			generated_text
				? {
						title: generated_text,
				  }
				: {}
		),
		{ headers: { "Content-Type": "application/json" } }
	);
}
