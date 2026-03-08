import React, { useState } from "react";

function SimpleCalculator() {
  const [result, setResult] = useState(0);
  const [input, setInput] = useState("");

  const handleCalculate = () => {
    try {
      // Simple evaluation - in real app this would be more sophisticated
      const evalResult = Function('"use strict"; return (' + input + ")")();
      setResult(evalResult);
    } catch {
      setResult(0);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold mb-4">Simple Calculator</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter expression (e.g., 2 + 2)"
          className="w-full p-2 border rounded"
        />
        <button
          onClick={handleCalculate}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Calculate
        </button>
        {result !== 0 && (
          <div className="p-2 bg-green-100 border rounded">
            Result: {result}
          </div>
        )}
      </div>
    </div>
  );
}

export default SimpleCalculator;
