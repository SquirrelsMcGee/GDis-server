export function splitStringIntoChunks(input: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < input.length) {
    // Find the position within the chunk where we can split without cutting a word
    let endIndex = startIndex + chunkSize;

    // If the chunk exceeds the string length, just take the remainder of the string
    if (endIndex >= input.length) {
      chunks.push(input.slice(startIndex));
      break;
    }

    // Ensure we don't cut a word by finding the last space within the chunk size
    let lastSpaceIndex = input.lastIndexOf(' ', endIndex);

    if (lastSpaceIndex > startIndex) {
      endIndex = lastSpaceIndex;
    }

    // Push the current chunk to the array
    chunks.push(input.slice(startIndex, endIndex));

    // Move the start index past the space (to avoid leading spaces in the next chunk)
    startIndex = endIndex + 1;
  }

  return chunks;
}
