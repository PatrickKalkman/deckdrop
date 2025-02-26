import argparse
import os
import time

import matplotlib.pyplot as plt
import numpy as np
from agent import QLearningAgent
from environment import ConnectThreeEnv
from tqdm import tqdm


def train(
    episodes=10000,
    save_interval=1000,
    learning_rate=0.1,
    discount_factor=0.9,
    exploration_rate=1.0,
    exploration_decay=0.995,
    min_exploration_rate=0.01,
    save_json=True,
    render_interval=0,
):
    """
    Train the Q-learning agent.

    Args:
        episodes: Number of episodes to train
        save_interval: Save model every X episodes
        learning_rate: Alpha - learning rate for Q-value updates
        discount_factor: Gamma - discount factor for future rewards
        exploration_rate: Initial exploration rate (epsilon)
        exploration_decay: Rate at which exploration decreases
        min_exploration_rate: Minimum exploration rate
        save_json: Whether to also save in JSON format for TypeScript
        render_interval: If > 0, render the game every X episodes
    """
    # Create output directory
    os.makedirs("models", exist_ok=True)

    # Initialize environment and agent
    env = ConnectThreeEnv()
    agent = QLearningAgent(
        learning_rate=learning_rate,
        discount_factor=discount_factor,
        exploration_rate=exploration_rate,
        exploration_decay=exploration_decay,
        min_exploration_rate=min_exploration_rate,
    )

    # Metrics
    wins = []
    losses = []
    draws = []
    rewards = []
    invalid_moves = []
    q_table_sizes = []
    exploration_rates = []

    start_time = time.time()

    # Training loop
    for episode in tqdm(range(episodes)):
        state = env.reset()
        total_reward = 0
        game_steps = 0
        invalid_move_count = 0

        # Play an episode
        while not env.done:
            # Get valid actions
            valid_actions = env.get_valid_actions()

            if not valid_actions:
                break

            # Choose an action
            action = agent.get_action(state, valid_actions)

            # Take the action
            next_state, reward, done, info = env.step(action)

            # Count invalid moves
            if info.get("invalid_move", False):
                invalid_move_count += 1

            # Get valid actions for next state
            next_valid_actions = []
            if not done:
                next_valid_actions = env.get_valid_actions()

            # Update Q-values
            agent.update(state, action, reward, next_state, next_valid_actions)

            state = next_state
            total_reward += reward
            game_steps += 1

            # Render game if requested
            if render_interval > 0 and episode % render_interval == 0:
                os.system("clear" if os.name == "posix" else "cls")
                print(f"Episode: {episode + 1}/{episodes}")
                print(f"Step: {game_steps}, Player: {env.current_player}")
                env.render()
                time.sleep(0.5)  # Pause to make rendering visible

        # Record game result
        if env.winner == 1:
            wins.append(1)
            losses.append(0)
            draws.append(0)
        elif env.winner == 2:
            wins.append(0)
            losses.append(1)
            draws.append(0)
        else:  # Draw
            wins.append(0)
            losses.append(0)
            draws.append(1)

        # Record metrics for this episode
        rewards.append(total_reward)
        invalid_moves.append(invalid_move_count)
        q_table_sizes.append(agent.get_q_table_size())
        exploration_rates.append(agent.exploration_rate)

        # Decay exploration rate
        agent.decay_exploration()

        # Save periodically
        if (episode + 1) % save_interval == 0 or episode == episodes - 1:
            # Calculate stats
            recent_rewards = np.mean(rewards[-100:])
            recent_win_rate = np.mean(wins[-100:])
            recent_loss_rate = np.mean(losses[-100:])
            recent_draw_rate = np.mean(draws[-100:])

            # Save models
            agent.save_qtable_pickle(f"models/qtable_episode_{episode + 1}.pkl")
            if save_json:
                agent.save_qtable_json(f"models/qtable_episode_{episode + 1}.json")

            # Log progress
            elapsed_time = time.time() - start_time
            print(f"\nEpisode {episode + 1} completed in {elapsed_time:.2f} seconds")
            print(f"Q-table size: {agent.get_q_table_size()} states")
            print(f"Recent win rate: {recent_win_rate:.2f}")
            print(f"Recent loss rate: {recent_loss_rate:.2f}")
            print(f"Recent draw rate: {recent_draw_rate:.2f}")
            print(f"Recent average reward: {recent_rewards:.2f}")
            print(f"Current exploration rate: {agent.exploration_rate:.4f}")

            # Plot metrics
            plot_metrics(episode, rewards, wins, losses, draws, q_table_sizes, exploration_rates)

    # Final save
    agent.save_qtable_pickle("models/qtable_final.pkl")
    if save_json:
        agent.save_qtable_json("models/qtable_final.json")

    return agent, rewards, wins, losses, draws


def plot_metrics(episode, rewards, wins, losses, draws, q_table_sizes, exploration_rates):
    """Plot training metrics."""
    plt.figure(figsize=(15, 10))

    # Calculate window size for moving averages
    window_size = min(100, len(rewards))

    # Plot rewards
    plt.subplot(2, 3, 1)
    plt.plot(rewards)
    plt.plot(np.convolve(rewards, np.ones(window_size) / window_size, mode="valid"))
    plt.title("Rewards per Episode")
    plt.xlabel("Episode")
    plt.ylabel("Total Reward")

    # Plot win rate
    plt.subplot(2, 3, 2)
    win_rate = np.convolve(wins, np.ones(window_size) / window_size, mode="valid")
    plt.plot(win_rate)
    plt.title("Win Rate (Moving Average)")
    plt.xlabel("Episode")
    plt.ylabel("Win Rate")
    plt.ylim(0, 1)

    # Plot game outcomes
    plt.subplot(2, 3, 3)
    outcomes = np.array([wins, losses, draws]).T
    if len(outcomes) > 0:
        cumulative_outcomes = np.cumsum(outcomes, axis=0)
        plt.stackplot(
            range(len(cumulative_outcomes)),
            [cumulative_outcomes[:, 0], cumulative_outcomes[:, 1], cumulative_outcomes[:, 2]],
            labels=["Wins", "Losses", "Draws"],
            colors=["green", "red", "blue"],
        )
        plt.legend(loc="upper left")
        plt.title("Cumulative Game Outcomes")
        plt.xlabel("Episode")
        plt.ylabel("Count")

    # Plot Q-table size
    plt.subplot(2, 3, 4)
    plt.plot(q_table_sizes)
    plt.title("Q-table Size Growth")
    plt.xlabel("Episode")
    plt.ylabel("Number of States")

    # Plot exploration rate
    plt.subplot(2, 3, 5)
    plt.plot(exploration_rates)
    plt.title("Exploration Rate Decay")
    plt.xlabel("Episode")
    plt.ylabel("Epsilon")
    plt.ylim(0, 1)

    plt.tight_layout()
    plt.savefig(f"models/training_progress_episode_{episode + 1}.png")
    plt.close()


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Train a Q-learning agent for Connect Three")
    parser.add_argument("--episodes", type=int, default=10000, help="Number of episodes to train")
    parser.add_argument("--save-interval", type=int, default=1000, help="Save model every X episodes")
    parser.add_argument("--learning-rate", type=float, default=0.1, help="Learning rate (alpha)")
    parser.add_argument("--discount-factor", type=float, default=0.9, help="Discount factor (gamma)")
    parser.add_argument("--exploration-rate", type=float, default=1.0, help="Initial exploration rate (epsilon)")
    parser.add_argument("--exploration-decay", type=float, default=0.995, help="Exploration decay rate")
    parser.add_argument("--min-exploration-rate", type=float, default=0.01, help="Minimum exploration rate")
    parser.add_argument("--no-json", action="store_false", dest="save_json", help="Do not save in JSON format")
    parser.add_argument("--render", type=int, default=0, help="Render every X episodes (0 for no rendering)")
    args = parser.parse_args()

    # Train the agent
    train(
        episodes=args.episodes,
        save_interval=args.save_interval,
        learning_rate=args.learning_rate,
        discount_factor=args.discount_factor,
        exploration_rate=args.exploration_rate,
        exploration_decay=args.exploration_decay,
        min_exploration_rate=args.min_exploration_rate,
        save_json=args.save_json,
        render_interval=args.render,
    )
