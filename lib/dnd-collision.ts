import {
  pointerWithin,
  closestCenter,
  type CollisionDetection,
} from "@dnd-kit/core";

const SIDEBAR_PREFIX = "sidebar-";

/**
 * Custom collision detection that prioritizes sidebar droppables.
 * Runs pointerWithin first — if pointer is inside a sidebar droppable, return it;
 * otherwise fall back to closestCenter for task sorting.
 */
export const sidebarAwareCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  const sidebarCollisions = pointerCollisions.filter(
    (collision) =>
      typeof collision.id === "string" && collision.id.startsWith(SIDEBAR_PREFIX)
  );

  if (sidebarCollisions.length > 0) {
    return sidebarCollisions;
  }

  return closestCenter(args);
};
