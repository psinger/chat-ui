import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { searchWeb } from "$lib/server/websearch/searchWeb";
import type { Message } from "$lib/types/Message";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type { WebSearch } from "$lib/types/WebSearch";
import { generateQuery } from "$lib/server/websearch/generateQuery";
import { parseWeb } from "$lib/server/websearch/parseWeb";
import { summarizeWeb } from "$lib/server/websearch/summarizeWeb";
import { createLogger } from "vite";
import { models_summarize } from "$lib/server/models";

interface GenericObject {
	[key: string]: GenericObject | unknown;
}

function removeLinks(obj: GenericObject) {
	for (const prop in obj) {
		if (prop.endsWith("link")) delete obj[prop];
		else if (typeof obj[prop] === "object") removeLinks(obj[prop] as GenericObject);
	}
	return obj;
}
export async function GET({ params, locals, url }) {
	const convId = new ObjectId(params.id);
	const searchId = new ObjectId();

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		throw error(404, "Conversation not found");
	}


	const summarizeModel = models_summarize.find((m) => m.id === conv.model);

	const prompt = z.string().trim().min(1).parse(url.searchParams.get("prompt"));

	const messages = (() => {
		return [...conv.messages, { content: prompt, from: "user", id: crypto.randomUUID() }];
	})() satisfies Message[];

	const stream = new ReadableStream({
		async start(controller) {
			const webSearch: WebSearch = {
				_id: searchId,
				convId: convId,
				prompt: prompt,
				searchQuery: "",
				knowledgeGraph: "",
				results: [],
				summary: "",
				messages: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			function appendUpdate(message: string, args?: string[]) {
				
				webSearch.messages.push({
					type: "update",
					message,
					args,
				});
				controller.enqueue(JSON.stringify({ messages: webSearch.messages }));

			}

			try {
				
				//webSearch.searchQuery = await generateQuery(messages, model);

				webSearch.searchQuery = messages[messages.length - 1].content;

				appendUpdate("Generating search query", [JSON.stringify(webSearch.searchQuery)]);

				await new Promise((r) => setTimeout(r, 1000));

				appendUpdate("Searching web");

				const results = await searchWeb(webSearch.searchQuery);


				let text = "";
				webSearch.results =
					(results.organic_results &&
						results.organic_results.map((el: { link: string }) => el.link)) ??
					[];

				//console.log(results);

				// if (results.knowledge_graph) {
				// 	console.log("knowledge graph found");
				// 	// if google returns a knowledge graph, we use it
				// 	//webSearch.knowledgeGraph = JSON.stringify(removeLinks(results.knowledge_graph));
				// 	//text = webSearch.knowledgeGraph;
					
				// 	text = removeLinks(results.knowledge_graph);
				// 	//console.log(text);
				// 	appendUpdate("Found a Google knowledge page");
				// } else 
				if (results.answer_box) {
					//console.log("answer box found");
					// if google returns a knowledge graph, we use it
					//webSearch.knowledgeGraph = JSON.stringify(removeLinks(results.knowledge_graph));
					//text = webSearch.knowledgeGraph;
					//console.log(results.answer_box);

					if (results.answer_box.link) {
						appendUpdate("Browsing", [JSON.stringify(results.answer_box.link)]);
					} else {
						appendUpdate("Browsing");
					}

					text = removeLinks(results.answer_box);
					
					text = JSON.stringify(text);
					//console.log(text);
					
					await new Promise((r) => setTimeout(r, 1000));
				} else 
				if (webSearch.results.length > 0) {
					//console.log("NO knowledge graph found");
					// otherwise we use the top result from search
					const topUrl = webSearch.results[0];
					appendUpdate("Browsing", [JSON.stringify(topUrl)]);

					text = await parseWeb(topUrl);
					if (!text) throw new Error("text of the webpage is null");

					appendUpdate("Summarizing web content");
					text = await summarizeWeb(text, webSearch.searchQuery, summarizeModel);
				} else {
					throw new Error("No results found for this search query");
				}

				webSearch.summary = text


			} catch (searchError) {
				if (searchError instanceof Error) {
					webSearch.messages.push({
						type: "error",
						message: "An error occurred with the web search",
						args: [JSON.stringify(searchError.message)],
					});
				}
			}

			const res = await collections.webSearches.insertOne(webSearch);

			webSearch.messages.push({
				type: "result",
				id: res.insertedId.toString(),
			});

	
			// await collections.conversations.updateOne(
			// 	{
			// 		_id: convId,
			// 	},
			// 	{
			// 		$set: {
			// 			messages,
			// 			updatedAt: new Date(),
			// 		},
			// 	}
			// );

			controller.enqueue(JSON.stringify({ messages: webSearch.messages }));
			
		},
	});


	return new Response(stream, { headers: { "Content-Type": "application/json" } });

}
