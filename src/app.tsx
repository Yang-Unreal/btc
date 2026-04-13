import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { Suspense } from "solid-js";
import "./app.css";
import Layout from "./components/Layout";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 60 * 1000,
		},
	},
});

export default function App() {
	return (
		<Router
			root={(props) => (
				<MetaProvider>
					<QueryClientProvider client={queryClient}>
						<Title>Directive | System</Title>
						<Layout>
							{/* 
                            Removed visual fallback to prevent "Black Screen Flash".
                            The individual pages (Profile) now manage their own Skeleton states
                            synchronously, so we don't want a global loader blocking them.
                        */}
							<Suspense>{props.children}</Suspense>
						</Layout>
					</QueryClientProvider>
				</MetaProvider>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
