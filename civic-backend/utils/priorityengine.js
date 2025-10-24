function calculatePriority(description="") {
  const text = description.toLowerCase();

  // High Priority: Immediate danger
  const highPriority = ["fire", "gas leak", "accident", "emergency", "power line", "pole down", "explosion","electricity"];
  if (highPriority.some(keyword => text.includes(keyword))) {
    return 3;
  }

  // Medium Priority: Public health
  const mediumPriority = ["sewage", "drainage", "overflow", "water main", "water leak", "pothole", "garbage", "dumpster"];
  if (mediumPriority.some(keyword => text.includes(keyword))) {
    return 2;
  }

  // Low Priority: General nuisance
  return 1;
}

module.exports = { calculatePriority };