import json
import pickle
import random


class QLearningAgent:
    """Q-learning agent for Connect Three."""

    def __init__(
        self,
        learning_rate=0.1,
        discount_factor=0.9,
        exploration_rate=1.0,
        exploration_decay=0.995,
        min_exploration_rate=0.01,
    ):
        """
        Initialize a Q-learning agent.

        Args:
            learning_rate: Alpha - how much to update Q-values based on new information
            discount_factor: Gamma - how much to value future rewards
            exploration_rate: Epsilon - probability of selecting a random action
            exploration_decay: Rate at which exploration decreases over time
            min_exploration_rate: Minimum exploration rate
        """
        self.q_table = {}  # State-action values
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.exploration_rate = exploration_rate
        self.exploration_decay = exploration_decay
        self.min_exploration_rate = min_exploration_rate

    def get_action(self, state, valid_actions):
        """
        Choose an action based on the current state and exploration strategy.

        Args:
            state: Current state representation
            valid_actions: List of valid actions

        Returns:
            Selected action
        """
        # If no valid actions, return None
        if not valid_actions:
            return None

        # Exploration: random action
        if random.random() < self.exploration_rate:
            return random.choice(valid_actions)

        # Exploitation: best known action
        return self._get_best_action(state, valid_actions)

    def _get_best_action(self, state, valid_actions):
        """Get the best action for the current state based on Q-values."""
        # Initialize Q-values for this state if not already in table
        if state not in self.q_table:
            self.q_table[state] = {action: 0.0 for action in range(5)}

        # If all Q-values are the same (e.g., all 0 for a new state)
        # prefer the middle column and columns closer to the middle
        q_values = [self.q_table[state].get(action, 0.0) for action in valid_actions]
        if all(q == q_values[0] for q in q_values):
            # Column preference: 2 (middle), then 1 & 3, then 0 & 4
            preference_order = [2, 1, 3, 0, 4]
            for col in preference_order:
                if col in valid_actions:
                    return col

        # Find action with highest Q-value
        max_q = max(self.q_table[state].get(action, 0.0) for action in valid_actions)

        # If multiple actions have the same max Q-value, randomly select one
        best_actions = [action for action in valid_actions if self.q_table[state].get(action, 0.0) == max_q]
        return random.choice(best_actions)

    def update(self, state, action, reward, next_state, next_valid_actions):
        """
        Update Q-values based on the observed transition.

        Args:
            state: Current state representation
            action: Action taken
            reward: Reward received
            next_state: Next state representation
            next_valid_actions: Valid actions in the next state
        """
        # Initialize Q-values if state not in table
        if state not in self.q_table:
            self.q_table[state] = {a: 0.0 for a in range(5)}

        # Initialize next state if needed
        if next_state not in self.q_table and next_valid_actions:
            self.q_table[next_state] = {a: 0.0 for a in range(5)}

        # Get max Q-value for next state
        max_next_q = 0.0
        if next_valid_actions:
            max_next_q = max(self.q_table[next_state].get(a, 0.0) for a in next_valid_actions)

        # Q-learning update formula (Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)])
        current_q = self.q_table[state].get(action, 0.0)
        new_q = current_q + self.learning_rate * (reward + self.discount_factor * max_next_q - current_q)
        self.q_table[state][action] = new_q

    def decay_exploration(self):
        """Decay the exploration rate."""
        self.exploration_rate = max(self.min_exploration_rate, self.exploration_rate * self.exploration_decay)

    def save_qtable_pickle(self, filename):
        """Save the Q-table to a pickle file."""
        with open(filename, "wb") as f:
            pickle.dump(self.q_table, f)

    def load_qtable_pickle(self, filename):
        """Load the Q-table from a pickle file."""
        with open(filename, "rb") as f:
            self.q_table = pickle.load(f)

    def save_qtable_json(self, filename):
        """
        Save the Q-table to a JSON file for TypeScript integration.
        Converts dictionary keys to strings for JSON compatibility.
        """
        # Convert inner dictionaries' numeric keys to strings
        json_compatible = {}
        for state, actions in self.q_table.items():
            json_compatible[state] = {str(action): value for action, value in actions.items()}

        with open(filename, "w") as f:
            json.dump(json_compatible, f)

    def load_qtable_json(self, filename):
        """
        Load the Q-table from a JSON file.
        Converts string keys back to integers for the actions.
        """
        with open(filename, "r") as f:
            json_table = json.load(f)

        # Convert string action keys back to integers
        self.q_table = {}
        for state, actions in json_table.items():
            self.q_table[state] = {int(action): value for action, value in actions.items()}

    def get_q_table_size(self):
        """Return the number of states in the Q-table."""
        return len(self.q_table)
