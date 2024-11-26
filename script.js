document.addEventListener('DOMContentLoaded', () => {
    const expression = document.getElementById('expression');
    const result = document.getElementById('result');
    const buttons = document.querySelectorAll('button');
    
    let lastInputWasTrig = false;
    let openBrackets = 0;

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const value = button.getAttribute('data-value');

            if (value === 'C') {
                expression.value = '';
                result.textContent = '';
                lastInputWasTrig = false;
                openBrackets = 0;
            } else if (value === '⌫') {
                if (expression.value.endsWith('sin(') || 
                    expression.value.endsWith('cos(') || 
                    expression.value.endsWith('tan(') ||
                    expression.value.endsWith('log(')) {
                    expression.value = expression.value.slice(0, -4);
                    openBrackets--;
                } else {
                    expression.value = expression.value.slice(0, -1);
                    if (expression.value.endsWith('(')) openBrackets++;
                    if (expression.value.endsWith(')')) openBrackets--;
                }
                lastInputWasTrig = false;
            } else if (value === '=') {
                try {
                    let expr = expression.value;
                    for (let i = 0; i < openBrackets; i++) {
                        expr += ')';
                    }
                    const answer = calculateExpression(expr);
                    result.textContent = Number.isInteger(answer) ? answer : answer.toFixed(6);
                } catch (error) {
                    result.textContent = 'Error';
                    console.error(error);
                }
                lastInputWasTrig = false;
                openBrackets = 0;
            } else if (['sin', 'cos', 'tan', 'log'].includes(value)) {
                if (expression.value && /[0-9π)]$/.test(expression.value)) {
                    expression.value += '*';
                }
                expression.value += value + '(';
                lastInputWasTrig = true;
                openBrackets++;
            } else if (value === '√') {
                if (expression.value && /[0-9π)]$/.test(expression.value)) {
                    expression.value += '*';
                }
                expression.value += 'sqrt(';
                openBrackets++;
            } else if (value === 'π') {
                if (expression.value && /[0-9)]$/.test(expression.value)) {
                    expression.value += '*';
                }
                expression.value += 'π';
            } else if (value === '°') {
                if (lastInputWasTrig) {
                    let expr = expression.value;
                    if (expr.endsWith(')')) {
                        expr = expr.slice(0, -1) + '°)';
                    } else {
                        expr += '°';
                    }
                    expression.value = expr;
                }
            } else if (value === '(') {
                if (expression.value && /[0-9π)]$/.test(expression.value)) {
                    expression.value += '*';
                }
                expression.value += value;
                openBrackets++;
            } else if (value === ')') {
                if (openBrackets > 0) {
                    expression.value += value;
                    openBrackets--;
                }
            } else {
                if (value.match(/[0-9]/) && expression.value.endsWith('π')) {
                    expression.value += '*';
                }
                expression.value += value;
            }
        });
    });
});

function calculateExpression(expr) {
    // Replace π with its value before processing
    expr = expr.replace(/π/g, '3.141592653589793');
    
    // Add implicit multiplication between number and opening parenthesis
    expr = expr.replace(/(\d+|\d*\.\d+)\(/g, '$1*(');
    
    // Remove spaces and replace multiple minuses
    expr = expr.replace(/\s+/g, '');
    
    // Process trig and other functions first
    expr = processFunctions(expr);

    // Convert operator sequences
    expr = expr.replace(/--/g, '+');
    expr = expr.replace(/\+-/g, '-');
    expr = expr.replace(/-\+/g, '-');
    
    // Split the expression into tokens while preserving negatives
    const tokens = [];
    let currentNumber = '';
    let isNegative = false;

    for (let i = 0; i < expr.length; i++) {
        const char = expr[i];
        
        if (char === '-') {
            if (i === 0 || /[\(*+\-/^]/.test(expr[i-1])) {
                isNegative = !isNegative;
                continue;
            }
        }
        
        if (/[0-9.]/.test(char)) {
            currentNumber += char;
        } else {
            if (currentNumber !== '') {
                tokens.push((isNegative ? -1 : 1) * parseFloat(currentNumber));
                currentNumber = '';
                isNegative = false;
            }
            if (char !== '-' || (char === '-' && !/[\(*+\-/^]/.test(expr[i-1]))) {
                tokens.push(char);
            }
        }
    }
    
    if (currentNumber !== '') {
        tokens.push((isNegative ? -1 : 1) * parseFloat(currentNumber));
    }

    const postfix = infixToPostfix(tokens);
    return evaluatePostfix(postfix);
}

function processFunctions(expr) {
    // Process trig functions
    const trigPattern = /(sin|cos|tan)\(([^)°]+)(°)?(\)|$)/g;
    expr = expr.replace(trigPattern, (match, func, value, isDegrees) => {
        try {
            // First evaluate the expression inside the brackets
            const innerValue = calculateExpression(value);
            let num = parseFloat(innerValue);
            
            if (isDegrees === '°') {
                num = (num * Math.PI) / 180;
            }
            
            let result;
            switch (func) {
                case 'sin': result = Math.sin(num); break;
                case 'cos': result = Math.cos(num); break;
                case 'tan': result = Math.tan(num); break;
            }
            
            if (Math.abs(result) < 1e-10) {
                result = 0;
            }
            
            return result.toString();
        } catch (error) {
            throw new Error(`Error processing ${func} function: ${error.message}`);
        }
    });

    // Process sqrt
    const sqrtPattern = /sqrt\(([^)]+)\)/g;
    expr = expr.replace(sqrtPattern, (match, value) => {
        // First evaluate the expression inside the brackets
        const innerValue = calculateExpression(value);
        const num = parseFloat(innerValue);
        if (num < 0) throw new Error('Cannot take square root of negative number');
        return Math.sqrt(num).toString();
    });

    // Process log (base 10)
    const logPattern = /log\(([^)]+)\)/g;
    expr = expr.replace(logPattern, (match, value) => {
        // First evaluate the expression inside the brackets
        const innerValue = calculateExpression(value);
        const num = parseFloat(innerValue);
        if (num <= 0) throw new Error('Cannot take log of non-positive number');
        return Math.log10(num).toString();
    });

    return expr;
}

function infixToPostfix(tokens) {
    const output = [];
    const operators = [];
    
    for (const token of tokens) {
        if (typeof token === 'number') {
            output.push(token);
        } else if (token === '(') {
            operators.push(token);
        } else if (token === ')') {
            while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                output.push(operators.pop());
            }
            operators.pop(); // Remove '('
        } else {
            while (
                operators.length > 0 &&
                operators[operators.length - 1] !== '(' &&
                getPrecedence(operators[operators.length - 1]) >= getPrecedence(token)
            ) {
                output.push(operators.pop());
            }
            operators.push(token);
        }
    }
    
    while (operators.length > 0) {
        output.push(operators.pop());
    }
    
    return output;
}

function getPrecedence(operator) {
    switch (operator) {
        case '+':
        case '-':
            return 1;
        case '*':
        case '/':
            return 2;
        case '^':
            return 3;
        default:
            return 0;
    }
}

function evaluatePostfix(postfix) {
    const stack = [];
    
    for (const token of postfix) {
        if (typeof token === 'number') {
            stack.push(token);
        } else {
            const b = stack.pop();
            const a = stack.pop();
            
            switch (token) {
                case '+':
                    stack.push(a + b);
                    break;
                case '-':
                    stack.push(a - b);
                    break;
                case '*':
                    stack.push(a * b);
                    break;
                case '/':
                    if (b === 0) throw new Error('Division by zero');
                    stack.push(a / b);
                    break;
                case '^':
                    stack.push(Math.pow(a, b));
                    break;
            }
        }
    }
    
    return stack[0];
}
