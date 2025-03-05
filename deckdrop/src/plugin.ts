import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { DeckDropGame } from "./actions/deck-drop-game";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded.
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the DeckDropGame action.
streamDeck.actions.registerAction(new DeckDropGame());

// Connect to the Stream Deck.
streamDeck.connect(); 

// Export your actions here
export const actions = [
  DeckDropGame
];