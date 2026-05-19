import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 font-mono text-sm">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-4xl w-full border-l-4 border-red-600 overflow-hidden">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
                        <div className="bg-red-50 p-4 rounded-lg mb-4 text-red-900 font-bold border border-red-200">
                            {this.state.error && this.state.error.toString()}
                        </div>
                        <div className="text-slate-600 mb-2 font-bold">Stack Trace:</div>
                        <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-auto max-h-96 text-xs whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
