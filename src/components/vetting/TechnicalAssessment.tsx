"use client";

import React, { useState, useEffect, useCallback } from "react";

// Types for the assessment data
interface AnswerOption {
  id: string;
  text: string;
}

interface Question {
  id?: string;
  question?: string;
  question_type?: "multiple_choice" | "text" | "code";
  answer_options?: AnswerOption[];
  time_limit_sec?: number;
}

interface AssessmentData {
  session_id?: string;
  questions?: Question[];
  title?: string;
  description?: string;
}

interface StoredAnswers {
  [questionId: string]: string | string[];
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}

interface TechnicalAssessmentProps {
  assessmentId?: string;
  onComplete?: (answers: StoredAnswers) => void;
  onError?: (error: string) => void;
}

const TechnicalAssessment: React.FC<TechnicalAssessmentProps> = ({
  assessmentId,
  onComplete,
  onError,
}) => {
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [storedAnswers, setStoredAnswers] = useState<StoredAnswers>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Fetch assessment data with safe access patterns
  const fetchAssessmentData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulated API call - replace with actual API call
      const response = await fetch(`/api/assessments/${assessmentId}`);
      const data: ApiResponse<AssessmentData> = await response.json();

      // Safe access pattern for nested data
      if (data?.data) {
        setAssessmentData(data.data);
        
        // Safe access for questions array and first question's time limit
        const firstQuestion = data.data?.questions?.[0];
        if (firstQuestion?.time_limit_sec) {
          setTimeRemaining(firstQuestion.time_limit_sec);
        }
      } else {
        setError("Failed to load assessment data");
        onError?.("Failed to load assessment data");
      }
    } catch (err) {
      // Safe error response access
      const apiError = err as ApiError;
      const errorMessage =
        apiError?.response?.data?.error ||
        apiError?.message ||
        "An unexpected error occurred";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, onError]);

  useEffect(() => {
    if (assessmentId) {
      fetchAssessmentData();
    }
  }, [assessmentId, fetchAssessmentData]);

  // Get current question with safe access
  const getCurrentQuestion = useCallback((): Question | undefined => {
    return assessmentData?.questions?.[currentQuestionIndex];
  }, [assessmentData, currentQuestionIndex]);

  // Get total questions count with safe access
  const getTotalQuestions = useCallback((): number => {
    return assessmentData?.questions?.length ?? 0;
  }, [assessmentData]);

  // Handle answer selection with safe access patterns
  const handleAnswerSelect = useCallback(
    (answer: string) => {
      const currentQuestion = getCurrentQuestion();
      const questionId = currentQuestion?.id;

      if (!questionId) return;

      setStoredAnswers((prev) => ({
        ...prev,
        [questionId]: answer,
      }));
    },
    [getCurrentQuestion]
  );

  // Handle multiple choice answers with safe access
  const handleMultipleChoiceSelect = useCallback(
    (optionId: string) => {
      const currentQuestion = getCurrentQuestion();
      const questionId = currentQuestion?.id;

      if (!questionId) return;

      const currentAnswer = storedAnswers?.[questionId];
      const currentAnswers = Array.isArray(currentAnswer) ? currentAnswer : [];

      const updatedAnswers = currentAnswers.includes(optionId)
        ? currentAnswers.filter((id) => id !== optionId)
        : [...currentAnswers, optionId];

      setStoredAnswers((prev) => ({
        ...prev,
        [questionId]: updatedAnswers,
      }));
    },
    [getCurrentQuestion, storedAnswers]
  );

  // Submit assessment with safe access
  const handleSubmit = useCallback(async () => {
    try {
      setIsLoading(true);

      // Safe access for session_id
      const sessionId = assessmentData?.session_id;
      if (!sessionId) {
        setError("Session ID not found");
        return;
      }

      const response = await fetch("/api/assessments/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          answers: storedAnswers,
        }),
      });

      const data: ApiResponse<{ success: boolean }> = await response.json();

      if (data?.data) {
        onComplete?.(storedAnswers);
      } else {
        setError(data?.error ?? "Failed to submit assessment");
      }
    } catch (err) {
      const apiError = err as ApiError;
      const errorMessage =
        apiError?.response?.data?.error ||
        apiError?.message ||
        "Failed to submit assessment";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [assessmentData, storedAnswers, onComplete, onError]);

  // Navigate to next question with safe access
  const handleNextQuestion = useCallback(() => {
    const totalQuestions = getTotalQuestions();
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex < totalQuestions) {
      setCurrentQuestionIndex(nextIndex);
      
      // Safe access for next question's time limit
      const nextQuestion = assessmentData?.questions?.[nextIndex];
      if (nextQuestion?.time_limit_sec) {
        setTimeRemaining(nextQuestion.time_limit_sec);
      } else {
        setTimeRemaining(null);
      }
    } else {
      // Assessment complete
      handleSubmit();
    }
  }, [currentQuestionIndex, getTotalQuestions, assessmentData, handleSubmit]);

  // Timer effect with safe access
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, handleNextQuestion]);

  // Navigate to previous question
  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      
      // Safe access for previous question's time limit
      const prevQuestion = assessmentData?.questions?.[prevIndex];
      if (prevQuestion?.time_limit_sec) {
        setTimeRemaining(prevQuestion.time_limit_sec);
      } else {
        setTimeRemaining(null);
      }
    }
  }, [currentQuestionIndex, assessmentData]);

  // Get answer for a specific question with safe access
  const getAnswerForQuestion = useCallback(
    (questionId: string | undefined): string | string[] | undefined => {
      if (!questionId) return undefined;
      return storedAnswers?.[questionId];
    },
    [storedAnswers]
  );

  // Check if question is answered with safe access
  const isQuestionAnswered = useCallback(
    (question: Question | undefined): boolean => {
      const questionId = question?.id;
      if (!questionId) return false;
      const answer = storedAnswers?.[questionId];
      if (Array.isArray(answer)) {
        return answer.length > 0;
      }
      return !!answer;
    },
    [storedAnswers]
  );

  // Render question navigation dots with safe access
  const renderNavigationDots = useCallback(() => {
    const questions = assessmentData?.questions;
    if (!questions || questions.length === 0) return null;

    return (
      <div className="flex gap-2 justify-center my-4">
        {questions.map((q, index) => {
          const questionId = q?.id;
          const isAnswered = isQuestionAnswered(q);
          const isCurrent = index === currentQuestionIndex;

          return (
            <button
              key={questionId ?? `fallback-question-${index}`}
              className={`w-3 h-3 rounded-full transition-colors ${
                isCurrent
                  ? "bg-blue-500"
                  : isAnswered
                  ? "bg-green-500"
                  : "bg-gray-300"
              }`}
              onClick={() => {
                setCurrentQuestionIndex(index);
                const selectedQuestion = assessmentData?.questions?.[index];
                if (selectedQuestion?.time_limit_sec) {
                  setTimeRemaining(selectedQuestion.time_limit_sec);
                }
              }}
              aria-label={`Go to question ${index + 1}`}
            />
          );
        })}
      </div>
    );
  }, [assessmentData, currentQuestionIndex, isQuestionAnswered]);

  // Render answer options with safe access
  const renderAnswerOptions = useCallback(() => {
    const currentQuestion = getCurrentQuestion();
    const questionType = currentQuestion?.question_type;
    const answerOptions = currentQuestion?.answer_options;
    const questionId = currentQuestion?.id;

    if (!currentQuestion) return null;

    switch (questionType) {
      case "multiple_choice":
        if (!answerOptions || answerOptions.length === 0) {
          return <p>No answer options available</p>;
        }
        return (
          <div className="space-y-2">
            {answerOptions.map((option, index) => {
              const optionId = option?.id;
              const optionText = option?.text;
              const currentAnswer = storedAnswers?.[questionId ?? ""];
              const isSelected = Array.isArray(currentAnswer)
                ? currentAnswer.includes(optionId ?? "")
                : currentAnswer === optionId;

              return (
                <button
                  key={optionId ?? `fallback-option-${index}`}
                  className={`w-full p-3 text-left border rounded-lg transition-colors ${
                    isSelected
                      ? "bg-blue-100 border-blue-500"
                      : "bg-white border-gray-300 hover:border-blue-300"
                  }`}
                  onClick={() => optionId && handleMultipleChoiceSelect(optionId)}
                >
                  {optionText ?? "Option text unavailable"}
                </button>
              );
            })}
          </div>
        );

      case "text":
        return (
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg min-h-[150px]"
            placeholder="Type your answer here..."
            value={(storedAnswers?.[questionId ?? ""] as string) ?? ""}
            onChange={(e) => handleAnswerSelect(e.target.value)}
          />
        );

      case "code":
        return (
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-3 py-2 border-b border-gray-300">
              <span className="text-sm text-gray-600">Code Editor</span>
            </div>
            <textarea
              className="w-full p-3 font-mono text-sm min-h-[200px] bg-gray-900 text-green-400"
              placeholder="// Write your code here..."
              value={(storedAnswers?.[questionId ?? ""] as string) ?? ""}
              onChange={(e) => handleAnswerSelect(e.target.value)}
            />
          </div>
        );

      default:
        return <p>Unknown question type</p>;
    }
  }, [getCurrentQuestion, storedAnswers, handleAnswerSelect, handleMultipleChoiceSelect]);

  // Loading state
  if (isLoading && !assessmentData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error && !assessmentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-red-500 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Assessment</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          onClick={fetchAssessmentData}
        >
          Try Again
        </button>
      </div>
    );
  }

  // No questions state with safe access
  if (!assessmentData?.questions?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-gray-600">No questions available for this assessment.</p>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();
  const totalQuestions = getTotalQuestions();

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header with safe access */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {assessmentData?.title ?? "Technical Assessment"}
        </h1>
        {assessmentData?.description && (
          <p className="text-gray-600 mt-2">{assessmentData.description}</p>
        )}
      </div>

      {/* Progress bar with safe access */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          {timeRemaining !== null && timeRemaining > 0 && (
            <span className={timeRemaining <= 30 ? "text-red-500 font-semibold" : ""}>
              Time remaining: {Math.floor(timeRemaining / 60)}:
              {String(timeRemaining % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Navigation dots */}
      {renderNavigationDots()}

      {/* Question content with safe access */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {currentQuestion?.question ?? "Question text unavailable"}
        </h2>

        {/* Question type indicator with safe access */}
        {currentQuestion?.question_type && (
          <div className="mb-4">
            <span className="inline-block px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded">
              {currentQuestion?.question_type === "multiple_choice"
                ? "Multiple Choice"
                : currentQuestion?.question_type === "text"
                ? "Written Response"
                : currentQuestion?.question_type === "code"
                ? "Code Challenge"
                : currentQuestion?.question_type}
            </span>
          </div>
        )}

        {/* Answer options */}
        {renderAnswerOptions()}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0 || isLoading}
        >
          Previous
        </button>

        {currentQuestionIndex < totalQuestions - 1 ? (
          <button
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleNextQuestion}
            disabled={isLoading}
          >
            Next
          </button>
        ) : (
          <button
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Submitting..." : "Submit Assessment"}
          </button>
        )}
      </div>

      {/* Error message with safe access */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default TechnicalAssessment;
