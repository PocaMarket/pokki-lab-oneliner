import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function MainLayout({ children, className }: MainLayoutProps) {
  return (
    <div className="flex justify-center w-full min-h-screen bg-gray-50">
      <div className={cn('relative w-full max-w-[425px] bg-white', className)}>{children}</div>
    </div>
  )
}
