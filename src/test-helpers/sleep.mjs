export default (delay, result) => new Promise((resolve) => setTimeout(() => resolve(result), delay));
