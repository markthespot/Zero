#!/usr/bin/env tsx

/**
 * Test Summary for Dovecot IMAP/POP3 Integration
 * This script provides a comprehensive summary of the integration testing
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'PARTIAL';
  details: string;
  issues?: string[];
  recommendations?: string[];
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkDirectoryStructure(): Promise<TestResult> {
  const requiredFiles = [
    'dovecot/docker-compose.yml',
    'dovecot/config/dovecot.conf',
    'dovecot/config/users',
    'dovecot/README.md',
    'apps/server/src/lib/driver/dovecot.ts',
    'apps/server/src/lib/driver/__tests__/dovecot.test.ts',
    'scripts/test-dovecot.ts',
    'DOVECOT_INTEGRATION.md',
  ];

  const missingFiles: string[] = [];
  const existingFiles: string[] = [];

  for (const file of requiredFiles) {
    const exists = await checkFileExists(file);
    if (exists) {
      existingFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  }

  return {
    name: 'Directory Structure',
    status: missingFiles.length === 0 ? 'PASS' : 'PARTIAL',
    details: `${existingFiles.length}/${requiredFiles.length} required files present`,
    issues: missingFiles.length > 0 ? [`Missing files: ${missingFiles.join(', ')}`] : undefined,
  };
}

async function checkDependencies(): Promise<TestResult> {
  try {
    const packageJsonPath = 'apps/server/package.json';
    const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
    
    const requiredDeps = ['imap', 'mailparser', 'nodemailer', 'poplib'];
    const requiredDevDeps = ['@types/imap', '@types/mailparser', '@types/nodemailer'];
    
    const missingDeps: string[] = [];
    const missingDevDeps: string[] = [];
    
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies?.[dep]) {
        missingDeps.push(dep);
      }
    }
    
    for (const dep of requiredDevDeps) {
      if (!packageJson.devDependencies?.[dep]) {
        missingDevDeps.push(dep);
      }
    }
    
    const allMissing = [...missingDeps, ...missingDevDeps];
    
    return {
      name: 'Dependencies',
      status: allMissing.length === 0 ? 'PASS' : 'FAIL',
      details: `${requiredDeps.length + requiredDevDeps.length - allMissing.length}/${requiredDeps.length + requiredDevDeps.length} dependencies present`,
      issues: allMissing.length > 0 ? [`Missing dependencies: ${allMissing.join(', ')}`] : undefined,
    };
  } catch (error: any) {
    return {
      name: 'Dependencies',
      status: 'FAIL',
      details: 'Failed to check dependencies',
      issues: [`Error reading package.json: ${error.message}`],
    };
  }
}

async function checkDatabaseSchema(): Promise<TestResult> {
  try {
    const schemaPath = 'apps/server/src/db/schema.ts';
    const schemaContent = await fs.promises.readFile(schemaPath, 'utf8');
    
    const checks = [
      { name: 'dovecot provider support', pattern: /providerId.*dovecot/ },
      { name: 'dovecotConnection table', pattern: /dovecotConnection.*createTable/ },
    ];
    
    const issues: string[] = [];
    
    for (const check of checks) {
      if (!check.pattern.test(schemaContent)) {
        issues.push(`Missing ${check.name} in schema`);
      }
    }
    
    return {
      name: 'Database Schema',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: `${checks.length - issues.length}/${checks.length} schema changes present`,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error: any) {
    return {
      name: 'Database Schema',
      status: 'FAIL',
      details: 'Failed to check schema',
      issues: [`Error reading schema: ${error.message}`],
    };
  }
}

async function checkDriverIntegration(): Promise<TestResult> {
  try {
    const driverIndexPath = 'apps/server/src/lib/driver/index.ts';
    const driverContent = await fs.promises.readFile(driverIndexPath, 'utf8');
    
    const checks = [
      { name: 'DovecotMailManager import', pattern: /import.*DovecotMailManager.*dovecot/ },
      { name: 'dovecot provider in supportedProviders', pattern: /dovecot:\s*DovecotMailManager/ },
    ];
    
    const issues: string[] = [];
    
    for (const check of checks) {
      if (!check.pattern.test(driverContent)) {
        issues.push(`Missing ${check.name}`);
      }
    }
    
    return {
      name: 'Driver Integration',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: `${checks.length - issues.length}/${checks.length} integration points present`,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error: any) {
    return {
      name: 'Driver Integration',
      status: 'FAIL',
      details: 'Failed to check driver integration',
      issues: [`Error reading driver index: ${error.message}`],
    };
  }
}

async function checkDockerSetup(): Promise<TestResult> {
  try {
    // Check if Docker is available
    const { execSync } = await import('child_process');
    
    try {
      execSync('docker --version', { stdio: 'ignore' });
    } catch {
      return {
        name: 'Docker Setup',
        status: 'SKIP',
        details: 'Docker not available in environment',
        recommendations: ['Install Docker to test local Dovecot setup'],
      };
    }
    
    // Check if container is running
    try {
      const output = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      const runningContainers = output.split('\n').filter(Boolean);
      
      const hasImapServer = runningContainers.some(name => 
        name.includes('imap') || name.includes('dovecot') || name.includes('mail')
      );
      
      return {
        name: 'Docker Setup',
        status: hasImapServer ? 'PASS' : 'PARTIAL',
        details: hasImapServer 
          ? 'IMAP/Mail server container is running' 
          : 'Docker available but no mail server running',
        recommendations: hasImapServer 
          ? undefined 
          : ['Start IMAP server: cd dovecot && docker-compose up -d'],
      };
    } catch {
      return {
        name: 'Docker Setup',
        status: 'PARTIAL',
        details: 'Docker available but unable to check containers',
      };
    }
  } catch (error: any) {
    return {
      name: 'Docker Setup',
      status: 'FAIL',
      details: 'Failed to check Docker setup',
      issues: [`Error: ${error.message}`],
    };
  }
}

async function checkNetworkConnectivity(): Promise<TestResult> {
  try {
    const net = await import('net');
    
    const checkPort = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.connect(port, 'localhost');
      });
    };
    
    const imapPort = await checkPort(143);
    const pop3Port = await checkPort(110);
    
    const openPorts = [];
    if (imapPort) openPorts.push('IMAP (143)');
    if (pop3Port) openPorts.push('POP3 (110)');
    
    return {
      name: 'Network Connectivity',
      status: openPorts.length > 0 ? 'PASS' : 'FAIL',
      details: openPorts.length > 0 
        ? `Accessible ports: ${openPorts.join(', ')}` 
        : 'No mail server ports accessible',
      issues: openPorts.length === 0 
        ? ['IMAP port 143 not accessible', 'POP3 port 110 not accessible'] 
        : undefined,
      recommendations: openPorts.length === 0 
        ? ['Start mail server container', 'Check firewall settings'] 
        : undefined,
    };
  } catch (error: any) {
    return {
      name: 'Network Connectivity',
      status: 'FAIL',
      details: 'Failed to check network connectivity',
      issues: [`Error: ${error.message}`],
    };
  }
}

async function runAllTests(): Promise<TestResult[]> {
  console.log('🧪 Running Dovecot Integration Test Summary...\n');
  
  const tests = [
    checkDirectoryStructure,
    checkDependencies,
    checkDatabaseSchema,
    checkDriverIntegration,
    checkDockerSetup,
    checkNetworkConnectivity,
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
      
      const statusIcon = {
        'PASS': '✅',
        'FAIL': '❌',
        'SKIP': '⏭️',
        'PARTIAL': '⚠️',
      }[result.status];
      
      console.log(`${statusIcon} ${result.name}: ${result.details}`);
      
      if (result.issues) {
        result.issues.forEach(issue => console.log(`   ❌ ${issue}`));
      }
      
      if (result.recommendations) {
        result.recommendations.forEach(rec => console.log(`   💡 ${rec}`));
      }
      
      console.log();
    } catch (error: any) {
      results.push({
        name: test.name,
        status: 'FAIL',
        details: 'Test execution failed',
        issues: [`Unexpected error: ${error.message}`],
      });
    }
  }
  
  return results;
}

async function generateSummary(results: TestResult[]) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⚠️  Partial: ${partial}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📋 Total: ${results.length}`);
  
  console.log('\n🎯 Overall Status:');
  if (failed === 0 && partial <= 1) {
    console.log('   🎉 Integration is ready for testing!');
  } else if (failed <= 2) {
    console.log('   ⚠️  Integration mostly complete, minor issues to resolve');
  } else {
    console.log('   ❌ Integration needs significant work');
  }
  
  console.log('\n📋 Next Steps:');
  
  const allIssues = results.flatMap(r => r.issues || []);
  const allRecommendations = results.flatMap(r => r.recommendations || []);
  
  if (allIssues.length > 0) {
    console.log('   🔧 Issues to resolve:');
    allIssues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  if (allRecommendations.length > 0) {
    console.log('   💡 Recommendations:');
    allRecommendations.forEach(rec => console.log(`      - ${rec}`));
  }
  
  if (allIssues.length === 0 && allRecommendations.length === 0) {
    console.log('   1. Start IMAP server: cd dovecot && docker-compose up -d');
    console.log('   2. Run integration tests: pnpm dovecot:test');
    console.log('   3. Test with real email operations');
    console.log('   4. Deploy to production environment');
  }
}

async function main() {
  const results = await runAllTests();
  await generateSummary(results);
}

// Run the test summary
main().catch(console.error);
