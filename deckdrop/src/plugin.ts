import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { DeckDropGame } from "./actions/deck-drop-game";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the increment action.
streamDeck.actions.registerAction(new DeckDropGame());

// Finally, connect to the Stream Deck.
streamDeck.connect();

// Register your actions here
export const actions = [
  DeckDropGame
];