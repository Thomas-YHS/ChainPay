import { Navigate, RouteObject } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import EmployerLayout from './features/employer/components/EmployerLayout'
import EmployeesPage from './features/employer/pages/EmployeesPage'
import PayoutPage from './features/employer/pages/PayoutPage'
import HistoryPage from './features/employer/pages/HistoryPage'
import EmployeePage from './features/employee/pages/EmployeePage'

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  {
    path: '/employer',
    element: <EmployerLayout />,
    children: [
      { index: true, element: <Navigate to="/employer/employees" replace /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'payout', element: <PayoutPage /> },
      { path: 'history', element: <HistoryPage /> },
    ],
  },
  { path: '/employee', element: <EmployeePage /> },
]
