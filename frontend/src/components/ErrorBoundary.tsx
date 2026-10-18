import { Component, type ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Last line of defense: a render throw anywhere in the tree must not leave a
// blank page. Show a recovery UI instead of the unmounted-app white screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-warm-50 to-iris-50/30 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <h1 className="text-2xl font-bold text-warm-900 mb-3">
              Something went wrong
            </h1>
            <p className="text-warm-600 mb-8">
              The page hit an unexpected error. Reloading usually fixes it.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-iris-600 hover:bg-iris-700 text-white py-6 text-lg rounded-xl"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
