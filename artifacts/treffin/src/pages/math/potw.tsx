import { useGetMathProblemOfWeek, getGetMathProblemOfWeekQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MathText } from "@/components/math/math-renderer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";

export default function ProblemOfWeek() {
  const { data: potw, isLoading } = useGetMathProblemOfWeek({ query: { queryKey: getGetMathProblemOfWeekQueryKey() } });

  if (isLoading) {
    return (
      <AppLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
        <Skeleton className="h-12 w-1/2 mx-auto mb-12" />
        <Skeleton className="h-64 w-full" />
      </div>
      </AppLayout>
    );
  }

  if (!potw || !potw.problem) {
    return (
      <AppLayout>
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-serif font-bold mb-4">No Problem of the Week Active</h1>
        <p className="text-muted-foreground mb-8">Check back later for our featured problem spotlight.</p>
        <Link href="/math" className="text-primary hover:underline">Browse all problems</Link>
      </div>
      </AppLayout>
    );
  }

  const { problem, featuredSolution } = potw;

  return (
    <AppLayout>
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-8 sm:mb-16">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 mb-6 py-1 px-3 text-sm tracking-widest uppercase">
          Problem of the Week
        </Badge>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">
          <MathText text={problem.title} />
        </h1>
        <div className="flex items-center justify-center gap-4 text-muted-foreground">
          <span>By {problem.userName}</span>
          <span>&bull;</span>
          <span className="flex items-center gap-1" style={{ color: problem.categoryColor }}>
            <span>{problem.categoryIcon}</span>
            {problem.categoryName}
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-8 md:p-12 shadow-md mb-12 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-500"></div>
        <div className="prose prose-invert prose-p:leading-relaxed prose-lg max-w-none text-foreground font-serif">
          <MathText text={problem.body} />
        </div>

        <div className="mt-10 pt-6 border-t border-border flex justify-center">
          <Link href={`/math/problem/${problem.id}`} className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md font-medium transition-colors">
            View Discussion & Submit Solution
          </Link>
        </div>
      </div>

      {featuredSolution && (
        <div className="mt-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px bg-border flex-1"></div>
            <h2 className="text-2xl font-serif font-bold text-center whitespace-nowrap">
              Featured Solution
            </h2>
            <div className="h-px bg-border flex-1"></div>
          </div>

          <div className="bg-secondary/30 border border-border rounded-xl p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold font-serif">
                  {featuredSolution.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-foreground">{featuredSolution.userName}</div>
                  <div className="text-xs text-muted-foreground">Winner this week</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                {featuredSolution.approach}
              </Badge>
            </div>

            <div className="prose prose-invert max-w-none text-foreground font-serif">
              <MathText text={featuredSolution.body} />
            </div>
          </div>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
